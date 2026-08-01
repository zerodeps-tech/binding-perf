import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runHttp1Load } from '@swarmmachina/benchkit/load/http1'
import parseArgs from '@swarmmachina/benchkit/parse-args'
import { distribution } from '@swarmmachina/benchkit/statistics'
import { getScenario } from './scenarios.js'
import SwmCoreServer from './swm-core-server.js'

const repoDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ORDERS = [
  [0, 1, 2],
  [1, 2, 0],
  [2, 0, 1],
  [0, 2, 1],
  [2, 1, 0],
  [1, 0, 2]
]

async function installedPackages() {
  const lock = JSON.parse(
    await fs.readFile(path.join(repoDir, 'package-lock.json'), 'utf8')
  )
  const version = (name) => lock.packages[`node_modules/${name}`]?.version

  return {
    benchkit: version('@swarmmachina/benchkit'),
    swmCore: version('@swarmmachina/swm-core'),
    swmUws: version('@swarmmachina/swm-uws')
  }
}

function loadOptions(entry, test, duration, workers) {
  return {
    name: `${entry.fw}-${test.name}`,
    method: test.method,
    url: `http://127.0.0.1:${entry.port}${test.path}`,
    durationMs: duration * 1_000,
    connections: test.connections,
    pipelining: test.pipelining || 1,
    workers,
    headers: test.headers || {},
    body: test.body || undefined
  }
}

function assertValidLoad(result, label) {
  if (result.errors.total !== 0 || result.non2xx !== 0) {
    throw new Error(
      `${label}: errors=${result.errors.total} non2xx=${result.non2xx}`
    )
  }

  if (result.loadGenerator.saturated) {
    throw new Error(
      `${label}: load generator saturated at ` +
        `${result.loadGenerator.maxWorkerEluPct.toFixed(1)}% worker ELU`
    )
  }
}

async function warm(entry, test, duration, workers) {
  const result = await runHttp1Load(loadOptions(entry, test, duration, workers))
  assertValidLoad(result, `${entry.fw} warmup`)
}

async function measure(entry, test, duration, workers, sampleMs, run) {
  await entry.server.startMetrics(sampleMs)
  const result = await runHttp1Load({
    ...loadOptions(entry, test, duration, workers),
    name: `${entry.fw}-${test.name}-${run}`
  })
  assertValidLoad(result, `${entry.fw} run ${run}`)
  const metrics = await entry.server.stopMetrics()

  return {
    id: entry.id,
    role: entry.role,
    slot: entry.slot,
    fw: entry.fw,
    completed: result.requests.completed,
    durationMs: result.durationMs,
    rps: result.requests.averagePerSecond,
    latencyP50Ms: result.latencyMs.p50Ms,
    latencyP95Ms: result.latencyMs.p95Ms,
    latencyP99Ms: result.latencyMs.p99Ms,
    errors: result.errors.total,
    non2xx: result.non2xx,
    loadGenerator: result.loadGenerator,
    transport: result.transport,
    metrics
  }
}

function buildSpecs(candidate, candidateSlot) {
  let controlIndex = 0

  return [0, 1, 2].map((slot) => {
    if (slot === candidateSlot) {
      return {
        id: `candidate-slot-${slot}`,
        role: 'candidate',
        slot,
        fw: candidate
      }
    }

    const id = controlIndex++ === 0 ? 'control-a' : 'control-b'

    return {
      id: `${id}-slot-${slot}`,
      role: 'control',
      slot,
      fw: id === 'control-a' ? 'core-off-a' : 'core-off-b'
    }
  })
}

async function runBatch({ args, test, candidateSlot, runs, runOffset }) {
  const entries = []
  const specs = buildSpecs(args.candidate, candidateSlot)

  try {
    for (const spec of specs) {
      const server = new SwmCoreServer({
        variant: spec.fw,
        testName: test.name,
        serverCpu: args.serverCpu
      })
      await server.start()
      entries.push({ ...spec, server, port: server.port })
    }

    for (const entry of entries) {
      process.stdout.write(
        `warmup candidateSlot=${candidateSlot} id=${entry.id} ` +
          `fw=${entry.fw} duration=${args.warmup}s\n`
      )
      await warm(entry, test, args.warmup, args.workers)
    }

    const batchRuns = []
    for (let index = 0; index < runs; index++) {
      const run = runOffset + index + 1
      const rows = []
      for (const entryIndex of ORDERS[index % ORDERS.length]) {
        const entry = entries[entryIndex]
        const row = await measure(
          entry,
          test,
          args.duration,
          args.workers,
          args.sampleMs,
          run
        )
        rows.push(row)
        process.stdout.write(
          `run=${run} candidateSlot=${candidateSlot} id=${entry.id} ` +
            `fw=${entry.fw} rps=${Math.round(row.rps)} ` +
            `p95=${row.latencyP95Ms.toFixed(2)}ms ` +
            `p99=${row.latencyP99Ms.toFixed(2)}ms ` +
            `cpu=${row.metrics?.cpuCorePct?.toFixed(1) ?? 'n/a'}% ` +
            `generatorElu=${row.loadGenerator.maxWorkerEluPct.toFixed(1)}% ` +
            `errors=${row.errors}\n`
        )
      }
      batchRuns.push({ run, candidateSlot, rows })
    }

    return batchRuns
  } finally {
    await Promise.all(entries.map((entry) => entry.server.stop()))
  }
}

async function main() {
  const packages = await installedPackages()
  const args = parseArgs(
    process.argv,
    {
      candidate: 'core-snapshot',
      testName: 'base-async',
      runs: 12,
      warmup: 3,
      duration: 1,
      connections: 100,
      pipelining: 10,
      workers: 4,
      serverCpu: null,
      sampleMs: 100,
      jsonOut: null
    },
    {
      '--candidate': (out, value) => {
        out.candidate = String(value)
      },
      '--test': (out, value) => {
        out.testName = String(value)
      },
      '--runs': (out, value) => {
        out.runs = Number(value)
      },
      '--warmup': (out, value) => {
        out.warmup = Number(value)
      },
      '--duration': (out, value) => {
        out.duration = Number(value)
      },
      '--connections': (out, value) => {
        out.connections = Number(value)
      },
      '--pipelining': (out, value) => {
        out.pipelining = Number(value)
      },
      '--workers': (out, value) => {
        out.workers = Number(value)
      },
      '--server-cpu': (out, value) => {
        out.serverCpu = Number(value)
      },
      '--sample-ms': (out, value) => {
        out.sampleMs = Number(value)
      },
      '--json-out': (out, value) => {
        out.jsonOut = String(value)
      }
    },
    { strict: true, offset: 2 }
  )

  const test = getScenario(args.testName)
  test.connections = args.connections
  test.pipelining = args.pipelining
  if (!Number.isInteger(args.runs) || args.runs < 3 || args.runs % 3 !== 0) {
    throw new Error('--runs must be a positive multiple of 3')
  }

  const runs = []
  const runsPerSlot = args.runs / 3
  for (let candidateSlot = 0; candidateSlot < 3; candidateSlot++) {
    const batch = await runBatch({
      args,
      test,
      candidateSlot,
      runs: runsPerSlot,
      runOffset: candidateSlot * runsPerSlot
    })
    runs.push(...batch)
  }

  const paired = runs.map(({ run, rows }) => {
    const [a, b] = rows.filter((row) => row.role === 'control')
    const candidate = rows.find((row) => row.role === 'candidate')
    const referenceRps = (a.rps + b.rps) / 2
    const cpuPerRequest = (row) => row.metrics.cpuMs / row.completed
    const referenceCpuPerRequest = (cpuPerRequest(a) + cpuPerRequest(b)) / 2
    const referenceP95 = (a.latencyP95Ms + b.latencyP95Ms) / 2
    const referenceP99 = (a.latencyP99Ms + b.latencyP99Ms) / 2

    return {
      run,
      controlThroughputDeltaPct: ((b.rps - a.rps) / a.rps) * 100,
      candidateThroughputDeltaPct:
        ((candidate.rps - referenceRps) / referenceRps) * 100,
      candidateCpuPerRequestDeltaPct:
        ((cpuPerRequest(candidate) - referenceCpuPerRequest) /
          referenceCpuPerRequest) *
        100,
      candidateLatencyP95DeltaPct:
        ((candidate.latencyP95Ms - referenceP95) / referenceP95) * 100,
      candidateLatencyP99DeltaPct:
        ((candidate.latencyP99Ms - referenceP99) / referenceP99) * 100
    }
  })

  const summary = {
    createdAt: new Date().toISOString(),
    system: {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      cpu: os.cpus()[0]?.model || 'unknown',
      logicalCpus: os.cpus().length,
      loadAvg: os.loadavg()
    },
    parameters: args,
    packages,
    loadGenerator: `@swarmmachina/benchkit@${packages.benchkit}`,
    runs,
    paired: {
      controlThroughputDeltaPct: distribution(
        paired.map((row) => row.controlThroughputDeltaPct)
      ),
      candidateThroughputDeltaPct: distribution(
        paired.map((row) => row.candidateThroughputDeltaPct)
      ),
      candidateCpuPerRequestDeltaPct: distribution(
        paired.map((row) => row.candidateCpuPerRequestDeltaPct)
      ),
      candidateLatencyP95DeltaPct: distribution(
        paired.map((row) => row.candidateLatencyP95DeltaPct)
      ),
      candidateLatencyP99DeltaPct: distribution(
        paired.map((row) => row.candidateLatencyP99DeltaPct)
      ),
      runs: paired
    }
  }

  for (const [label, values] of [
    ['control throughput', summary.paired.controlThroughputDeltaPct],
    ['candidate throughput', summary.paired.candidateThroughputDeltaPct],
    ['candidate CPU/request', summary.paired.candidateCpuPerRequestDeltaPct],
    ['candidate p95', summary.paired.candidateLatencyP95DeltaPct],
    ['candidate p99', summary.paired.candidateLatencyP99DeltaPct]
  ]) {
    process.stdout.write(
      `${label}: median=${values.median.toFixed(2)}% ` +
        `IQR=[${values.q1.toFixed(2)}%, ${values.q3.toFixed(2)}%]\n`
    )
  }

  if (args.jsonOut) {
    await fs.mkdir(path.dirname(args.jsonOut), { recursive: true })
    await fs.writeFile(args.jsonOut, `${JSON.stringify(summary, null, 2)}\n`)
    process.stdout.write(`wrote ${args.jsonOut}\n`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
