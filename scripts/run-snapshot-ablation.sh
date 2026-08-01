#!/usr/bin/env bash

set -euo pipefail

repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
source_dir=${SWM_UWS_SOURCE_DIR:-}
source_ref=${SWM_UWS_SOURCE_REF:-v0.5.7}
node_bin=${NODE_BIN:-node}
server_cpu=${SWM_SERVER_CPU:-2}
load_cpus=${SWM_LOAD_CPUS:-3-6}
governor_cpus=${SWM_GOVERNOR_CPUS:-"2 3 4 5 6"}
set_performance_governor=${SWM_SET_PERFORMANCE_GOVERNOR:-1}
temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/binding-perf-ablation.XXXXXX")
source_work="$temp_dir/swm-uws"
bench_work="$temp_dir/bench"
staged_results="$temp_dir/ablation"
declare -A previous_governors=()

restore_governors() {
  for cpu in "${!previous_governors[@]}"; do
    printf '%s' "${previous_governors[$cpu]}" \
      > "/sys/devices/system/cpu/cpu$cpu/cpufreq/scaling_governor"
  done
}

cleanup() {
  restore_governors
  rm -rf "$temp_dir"
}

trap cleanup EXIT

if [[ -z "$source_dir" ]]; then
  printf 'SWM_UWS_SOURCE_DIR must point to a clone containing tag %s\n' "$source_ref" >&2
  exit 1
fi

for command in git npm taskset perf sha256sum nm tar; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf '%s is required\n' "$command" >&2
    exit 1
  fi
done

if [[ ! -x "$node_bin" ]] && ! command -v "$node_bin" >/dev/null 2>&1; then
  printf 'Node.js executable not found: %s\n' "$node_bin" >&2
  exit 1
fi

node_version=$($node_bin -p 'process.versions.node')
if [[ "$node_version" != 24.* ]]; then
  printf 'Node.js 24 is required, got %s\n' "$node_version" >&2
  exit 1
fi

source_commit=$(git -C "$source_dir" rev-parse "$source_ref^{commit}")
mkdir -p "$source_work" "$bench_work" "$staged_results"
git -C "$source_dir" archive "$source_commit" | tar -x -C "$source_work"

(
  cd "$source_work"
  git apply "$repo_dir/patches/swm-uws-profile-symbols.patch"
  git apply "$repo_dir/patches/swm-uws-request-snapshot-ablation.patch"
)

node_dir=$(cd -- "$(dirname -- "$(command -v "$node_bin")")" && pwd)
(
  cd "$source_work"
  PATH="$node_dir:$PATH" npm ci
  PATH="$node_dir:$PATH" npm run build:native
  PATH="$node_dir:$PATH" npm test
)

node_abi=$($node_bin -p 'process.versions.modules')
native_binary="$source_work/prebuilds/linux-x64-glibc/node-v$node_abi.node"
if [[ ! -f "$native_binary" ]]; then
  printf 'Built native binary not found: %s\n' "$native_binary" >&2
  exit 1
fi

if [[ -z "$(nm -C "$native_binary" | grep RequestSnapshot)" ]]; then
  printf 'RequestSnapshot symbol is missing from %s\n' "$native_binary" >&2
  exit 1
fi

native_sha256=$(sha256sum "$native_binary" | awk '{print $1}')

cp "$repo_dir/package.json" "$repo_dir/package-lock.json" "$bench_work/"
cp -R "$repo_dir/harness" "$bench_work/"
mkdir -p "$bench_work/scripts"
cp "$repo_dir/scripts/profile-core-binding.js" "$bench_work/scripts/"
(
  cd "$bench_work"
  PATH="$node_dir:$PATH" npm ci
)

installed_binary="$bench_work/node_modules/@swarmmachina/swm-uws/prebuilds/linux-x64-glibc/node-v$node_abi.node"
cp "$native_binary" "$installed_binary"

if [[ "$set_performance_governor" == 1 ]]; then
  for cpu in $governor_cpus; do
    governor_file="/sys/devices/system/cpu/cpu$cpu/cpufreq/scaling_governor"
    if [[ ! -w "$governor_file" ]]; then
      printf 'Cannot set CPU governor through %s\n' "$governor_file" >&2
      exit 1
    fi
    previous_governors[$cpu]=$(<"$governor_file")
    printf 'performance' > "$governor_file"
  done
  measured_governor=performance
else
  measured_governor=unchanged
fi

run_mode() {
  local ablation_mode=$1
  local profile_mode=snapshot

  if [[ "$ablation_mode" == control ]]; then
    profile_mode=control
    ablation_mode=production
  fi

  printf '\n=== requestSnapshot ablation: %s ===\n' "$1"
  SWM_UWS_SNAPSHOT_ABLATION="$ablation_mode" \
    SWM_UWS_SOURCE_REF="$source_ref@$source_commit" \
    SWM_UWS_NATIVE_SHA256="$native_sha256" \
    SWM_PROFILE_CPU_GOVERNOR="$measured_governor" \
    SWM_PROFILE_WARMUP=30 \
    SWM_PROFILE_DURATION=30 \
    SWM_PROFILE_SERVER_CPU="$server_cpu" \
    SWM_PROFILE_CLIENT_CPUS="$load_cpus" \
    taskset -c "$load_cpus" "$node_bin" \
      "$bench_work/scripts/profile-core-binding.js" \
      "$profile_mode" "$staged_results/$1"
}

for mode in control static shape names method url query headers params production; do
  run_mode "$mode"
done

"$node_bin" "$repo_dir/scripts/write-ablation-metadata.js" \
  "$staged_results" "$source_ref" "$source_commit" \
  "$native_sha256" "$measured_governor"
find "$staged_results" \( -name perf.data -o -name 'isolate-*.log' \) -delete
rm -rf "$repo_dir/results/ablation"
mv "$staged_results" "$repo_dir/results/ablation"
"$node_bin" "$repo_dir/scripts/summarize-ablation.js" \
  "$repo_dir/results/ablation" \
  "$repo_dir/results/request-snapshot-ablation.md"

printf '\nDiagnostic results written to %s\n' "$repo_dir/results/ablation"
