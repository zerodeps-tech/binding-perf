import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { runHttp1Load } from '@swarmmachina/benchkit/load/http1'
import { normalizePerfCounters, parsePerfStat } from '@swarmmachina/benchkit/profiling'
import SwmCoreServer from '../harness/swm-core-server.js'

const EVENTS = 'cycles:u,instructions:u,branches:u,branch-misses:u,cache-references:u,cache-misses:u'

class CoreBindingProfiler {
  #mode
  #outDir
  #warmupSeconds
  #durationSeconds
  #connections
  #pipelining
  #serverCpu
  #server = null

  constructor({ mode, outDir }) {
    if (mode !== 'control' && mode !== 'snapshot') {
      throw new Error('mode must be control or snapshot')
    }

    this.#mode = mode
    this.#outDir = path.resolve(
      outDir || path.join('results', 'profiles', mode)
    )
    this.#warmupSeconds = positiveNumber('SWM_PROFILE_WARMUP', 30)
    this.#durationSeconds = positiveNumber('SWM_PROFILE_DURATION', 30)
    this.#connections = positiveNumber('SWM_PROFILE_CONNECTIONS', 100)
    this.#pipelining = positiveNumber('SWM_PROFILE_PIPELINING', 10)
    this.#serverCpu = String(process.env.SWM_PROFILE_SERVER_CPU || '2')
  }

  async run() {
    await fsp.mkdir(this.#outDir, { recursive: true })

    const variant = this.#mode === 'snapshot' ? 'core-snapshot' : 'core-off'

    process.stdout.write(`mode=${this.#mode} output=${this.#outDir}\n`)
    process.stdout.write(`warmup ${this.#warmupSeconds}s\n`)
    this.#server = new SwmCoreServer({
      variant,
      testName: 'base-async',
      serverCpu: Number(this.#serverCpu),
      workingDirectory: this.#outDir,
      perfBasicProf: true
    })
    await this.#server.start()

    try {
      await this.#load(this.#warmupSeconds)

      process.stdout.write(`perf stat ${this.#durationSeconds}s\n`)
      await this.#server.startMetrics(100)

      const statFile = path.join(this.#outDir, 'perf-stat.csv')
      const statProcess = runCommand('perf', [
        'stat',
        '-x,',
        '-e',
        EVENTS,
        '-p',
        String(this.#server.pid),
        '-o',
        statFile,
        '--',
        'sleep',
        String(this.#durationSeconds)
      ])
      const statLoad = await this.#load(this.#durationSeconds)
      await statProcess

      process.stdout.write(`perf record ${this.#durationSeconds}s\n`)
      const perfData = path.join(this.#outDir, 'perf.data')
      const recordProcess = runCommand('perf', [
        'record',
        '-F',
        '499',
        '-e',
        'cycles:u',
        '-g',
        '--call-graph',
        'fp',
        '-p',
        String(this.#server.pid),
        '-o',
        perfData,
        '--',
        'sleep',
        String(this.#durationSeconds)
      ])
      const profileLoad = await this.#load(this.#durationSeconds)
      await recordProcess

      const metrics = await this.#server.stopMetrics()

      if (process.env.SWM_PROFILE_PERF_SCRIPT === '1') {
        await runCommandToFile(
          'perf',
          ['script', '-i', perfData],
          path.join(this.#outDir, 'perf.script')
        )
      }
      await runCommandToFile(
        'perf',
        [
          'report',
          '-i',
          perfData,
          '--stdio',
          '--children',
          '-g',
          'none',
          '--percent-limit',
          '0.10',
          '--sort',
          'overhead,dso,symbol'
        ],
        path.join(this.#outDir, 'perf-inclusive.txt')
      )
      if (process.env.SWM_PROFILE_FULL_REPORT === '1') {
        await runCommandToFile(
          'perf',
          [
            'report',
            '-i',
            perfData,
            '--stdio',
            '--children',
            '--percent-limit',
            '0.25',
            '--sort',
            'dso,symbol'
          ],
          path.join(this.#outDir, 'perf-report.txt')
        )
      }
      await runCommandToFile(
        'perf',
        [
          'report',
          '-i',
          perfData,
          '--stdio',
          '--no-children',
          '-g',
          'none',
          '--percent-limit',
          '0.10',
          '--sort',
          'overhead,dso,symbol'
        ],
        path.join(this.#outDir, 'perf-self.txt')
      )

      const counters = normalizePerfCounters(
        parsePerfStat(await fsp.readFile(statFile, 'utf8')),
        statLoad.requests.completed
      )
      const summary = {
        createdAt: new Date().toISOString(),
        mode: this.#mode,
        system: {
          node: process.version,
          platform: `${process.platform}-${process.arch}`,
          cpu: os.cpus()[0]?.model || 'unknown',
          logicalCpus: os.cpus().length
        },
        parameters: {
          warmupSeconds: this.#warmupSeconds,
          durationSeconds: this.#durationSeconds,
          connections: this.#connections,
          pipelining: this.#pipelining,
          serverCpu: this.#serverCpu,
          clientCpuAffinity: process.env.SWM_PROFILE_CLIENT_CPUS || '3-6',
          cpuGovernor: process.env.SWM_PROFILE_CPU_GOVERNOR || 'not recorded',
          perfFrequencyHz: 499,
          perfEvent: 'cycles:u',
          snapshotAblation:
            process.env.SWM_UWS_SNAPSHOT_ABLATION || 'production',
          swmUwsSourceRef: process.env.SWM_UWS_SOURCE_REF || null,
          nativeBinarySha256: process.env.SWM_UWS_NATIVE_SHA256 || null
        },
        serverPid: this.#server.pid,
        statLoad,
        profileLoad,
        counters,
        serverMetrics: metrics
      }

      await fsp.writeFile(
        path.join(this.#outDir, 'summary.json'),
        `${JSON.stringify(summary, null, 2)}\n`
      )
      await fsp.writeFile(path.join(this.#outDir, 'report.md'), renderReport(summary))
      process.stdout.write(`${JSON.stringify(compactSummary(summary), null, 2)}\n`)
    } finally {
      await this.#server.stop()
    }
  }

  async #load(durationSeconds) {
    const result = await runHttp1Load({
      url: 'http://127.0.0.1:' + this.#server.port + '/base-async',
      name: `core-${this.#mode}`,
      connections: this.#connections,
      pipelining: this.#pipelining,
      workers: 4,
      durationMs: durationSeconds * 1_000
    })

    if (result.errors.total !== 0 || result.non2xx !== 0) {
      throw new Error(
        `load failed: errors=${result.errors.total} non2xx=${result.non2xx}`
      )
    }

    if (result.loadGenerator.saturated) {
      throw new Error(
        `load generator saturated at ${result.loadGenerator.maxWorkerEluPct.toFixed(1)}% worker ELU`
      )
    }

    return result
  }
}

function positiveNumber(name, fallback) {
  const value = Number(process.env[name] || fallback)

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be positive`)
  }

  return value
}

async function runCommand(command, args) {
  const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'] })
  const [code, signal] = await once(child, 'exit')

  if (code !== 0) {
    throw new Error(`${command} failed: code=${code} signal=${signal || 'none'}`)
  }
}

async function runCommandToFile(command, args, outputFile) {
  const output = fs.openSync(outputFile, 'w')
  const child = spawn(command, args, {
    stdio: ['ignore', output, 'inherit']
  })

  try {
    const [code, signal] = await once(child, 'exit')

    if (code !== 0) {
      throw new Error(`${command} failed: code=${code} signal=${signal || 'none'}`)
    }
  } finally {
    fs.closeSync(output)
  }
}

function compactSummary(summary) {
  const load = summary.statLoad

  return {
    mode: summary.mode,
    snapshotAblation: summary.parameters.snapshotAblation,
    requestsPerSecond: load.requests.averagePerSecond,
    latencyP95Ms: load.latencyMs.p95Ms,
    latencyP99Ms: load.latencyMs.p99Ms,
    errors: load.errors.total,
    maxGeneratorEluPct: load.loadGenerator.maxWorkerEluPct,
    eluPct: summary.serverMetrics?.eluPct,
    rssPeakMB: summary.serverMetrics?.memMB?.rssPeak,
    countersPerRequest: Object.fromEntries(
      summary.counters
        .filter((counter) => counter.status === 'counted')
        .map((counter) => [counter.event, counter.perOperation])
    )
  }
}

function renderReport(summary) {
  const compact = compactSummary(summary)
  const counterRows = Object.entries(compact.countersPerRequest)
    .map(([event, value]) => `| ${event} | ${value.toFixed(3)} |`)
    .join('\n')

  return `# ${summary.mode} mixed JS/C++ CPU profile

| Parameter | Value |
| --- | ---: |
| Node.js | ${summary.system.node} |
| CPU | ${summary.system.cpu} |
| Snapshot mode | ${summary.parameters.snapshotAblation} |
| Warmup | ${summary.parameters.warmupSeconds}s |
| Duration | ${summary.parameters.durationSeconds}s per perf phase |
| Connections | ${summary.parameters.connections} |
| Pipelining | ${summary.parameters.pipelining} |
| Server CPU | ${summary.parameters.serverCpu} |
| Client CPUs | ${summary.parameters.clientCpuAffinity} |
| CPU governor | ${summary.parameters.cpuGovernor} |

| Result | Value |
| --- | ---: |
| Throughput | ${compact.requestsPerSecond.toFixed(0)} req/s |
| p95 | ${compact.latencyP95Ms.toFixed(3)} ms |
| p99 | ${compact.latencyP99Ms.toFixed(3)} ms |
| ELU | ${compact.eluPct.toFixed(2)}% |
| Generator ELU max | ${compact.maxGeneratorEluPct.toFixed(2)}% |
| RSS peak | ${compact.rssPeakMB.toFixed(2)} MiB |
| Errors | ${compact.errors} |

| Hardware counter | Per request |
| --- | ---: |
${counterRows}
`
}

const [mode, outDir] = process.argv.slice(2)

if (!mode) {
  throw new Error('usage: node profile-core-binding.js <control|snapshot> [out-dir]')
}

await new CoreBindingProfiler({ mode, outDir }).run()
