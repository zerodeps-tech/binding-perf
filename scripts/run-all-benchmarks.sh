#!/usr/bin/env bash

set -euo pipefail

repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
result_dir=${SWM_RESULT_DIR:-"$repo_dir/results/benchkit"}
node_bin=${NODE_BIN:-node}
server_cpu=${SWM_SERVER_CPU:-2}
load_cpus=${SWM_LOAD_CPUS:-3-6}
harness="$repo_dir/harness/native-fast-path-triad.js"
temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/binding-perf.XXXXXX")

cleanup() {
  rm -rf "$temp_dir"
}

trap cleanup EXIT

if ! command -v taskset >/dev/null 2>&1; then
  printf 'taskset is required; run this benchmark on Linux\n' >&2
  exit 1
fi

common=(
  --warmup 30
  --duration 15
  --connections 100
  --workers 4
  --server-cpu "$server_cpu"
  --sample-ms 100
)

run_case() {
  local name=$1
  shift

  printf '\n=== %s ===\n' "$name"
  taskset -c "$load_cpus" "$node_bin" "$harness" "$@" "${common[@]}" \
    --json-out "$temp_dir/$name.json"
}

run_case snapshot \
  --candidate core-snapshot --test base-async --runs 12 --pipelining 10
run_case batch \
  --candidate core-batch --test headers-prepared --runs 12 --pipelining 10
run_case collect \
  --candidate core-collect --test post-base --runs 12 --pipelining 1
run_case control-async \
  --candidate core-off --test base-async --runs 3 --pipelining 10
run_case control-headers \
  --candidate core-off --test headers-prepared --runs 3 --pipelining 10
run_case control-post \
  --candidate core-off --test post-base --runs 3 --pipelining 1

mkdir -p "$result_dir"
rm -f \
  "$result_dir/snapshot.json" \
  "$result_dir/batch.json" \
  "$result_dir/collect.json" \
  "$result_dir/control-get.json" \
  "$result_dir/control-async.json" \
  "$result_dir/control-headers.json" \
  "$result_dir/control-post.json"
for name in snapshot batch collect control-async control-headers control-post; do
  mv "$temp_dir/$name.json" "$result_dir/$name.json"
done

printf '\nResults written to %s\n' "$result_dir"
