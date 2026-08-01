import fs from 'node:fs/promises'
import path from 'node:path'
import { median } from '@swarmmachina/benchkit/statistics'

const CASES = [
  ['snapshot', 'requestSnapshot'],
  ['batch', 'responseBatch'],
  ['collect', 'collectBody'],
  ['control-async', 'all-control async GET'],
  ['control-headers', 'all-control prepared headers'],
  ['control-post', 'all-control POST']
]

function pair(values) {
  return `${formatPct(values.median)} [${formatPct(values.q1)}; ${formatPct(values.q3)}]`
}

function formatPct(value) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a'
}

function summarizeRunMetrics(data) {
  const referenceP95 = []
  const candidateP95 = []
  const referenceP99 = []
  const candidateP99 = []
  const referenceElu = []
  const candidateElu = []
  const referenceRss = []
  const candidateRss = []
  let errors = 0
  let maxGeneratorElu = 0

  for (const run of data.runs) {
    const controls = run.rows.filter((row) => row.role === 'control')
    const candidate = run.rows.find((row) => row.role === 'candidate')
    const average = (rows, read) =>
      rows.reduce((total, row) => total + read(row), 0) / rows.length

    referenceP95.push(average(controls, (row) => row.latencyP95Ms))
    candidateP95.push(candidate.latencyP95Ms)
    referenceP99.push(average(controls, (row) => row.latencyP99Ms))
    candidateP99.push(candidate.latencyP99Ms)
    referenceElu.push(average(controls, (row) => row.metrics.eluPct))
    candidateElu.push(candidate.metrics.eluPct)
    referenceRss.push(average(controls, (row) => row.metrics.memMB.rssPeak))
    candidateRss.push(candidate.metrics.memMB.rssPeak)

    for (const row of run.rows) {
      errors += row.errors + row.non2xx
      maxGeneratorElu = Math.max(
        maxGeneratorElu,
        row.loadGenerator.maxWorkerEluPct
      )
    }
  }

  return {
    referenceP95: median(referenceP95),
    candidateP95: median(candidateP95),
    referenceP99: median(referenceP99),
    candidateP99: median(candidateP99),
    referenceElu: median(referenceElu),
    candidateElu: median(candidateElu),
    referenceRss: median(referenceRss),
    candidateRss: median(candidateRss),
    errors,
    maxGeneratorElu
  }
}

function render(rows) {
  const first = rows[0].data
  const parameters = first.parameters

  const lines = [
    '# Benchkit benchmark report',
    '',
    `- Node.js: ${first.system.node}`,
    `- CPU: ${first.system.cpu}`,
    `- Load generator: ${first.loadGenerator}`,
    `- swm-core: ${first.packages?.swmCore || 'not recorded'}`,
    `- swm-uws: ${first.packages?.swmUws || 'not recorded'}`,
    `- Connections: ${parameters.connections}`,
    `- Workers: ${parameters.workers}`,
    `- Warmup: ${parameters.warmup}s per process`,
    `- Window: ${parameters.duration}s`,
    `- Candidate rounds: ${parameters.runs}`,
    '',
    '| Case | Δ RPS, median [p25; p75] | Δ CPU/request | Δ p95 | Δ p99 | Errors | Max generator ELU |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |'
  ]

  for (const row of rows) {
    const paired = row.data.paired
    const metrics = summarizeRunMetrics(row.data)
    lines.push(
      `| ${row.label} | ${pair(paired.candidateThroughputDeltaPct)} | ` +
        `${pair(paired.candidateCpuPerRequestDeltaPct)} | ` +
        `${pair(paired.candidateLatencyP95DeltaPct)} | ` +
        `${pair(paired.candidateLatencyP99DeltaPct)} | ` +
        `${metrics.errors} | ${formatNumber(metrics.maxGeneratorElu)}% |`
    )
  }

  lines.push(
    '',
    '## Absolute medians',
    '',
    '| Case | p95 control → candidate | p99 control → candidate | ELU control → candidate | RSS peak control → candidate |',
    '| --- | ---: | ---: | ---: | ---: |'
  )

  for (const row of rows) {
    const metrics = summarizeRunMetrics(row.data)
    lines.push(
      `| ${row.label} | ${formatNumber(metrics.referenceP95)} → ` +
        `${formatNumber(metrics.candidateP95)} ms | ` +
        `${formatNumber(metrics.referenceP99)} → ${formatNumber(metrics.candidateP99)} ms | ` +
        `${formatNumber(metrics.referenceElu)}% → ${formatNumber(metrics.candidateElu)}% | ` +
        `${formatNumber(metrics.referenceRss)} → ${formatNumber(metrics.candidateRss)} MiB |`
    )
  }

  return `${lines.join('\n')}\n`
}

const inputDir = path.resolve(process.argv[2] || 'results/benchkit')
const outputFile = process.argv[3] ? path.resolve(process.argv[3]) : null
const rows = []

for (const [name, label] of CASES) {
  const file = path.join(inputDir, `${name}.json`)
  const data = JSON.parse(await fs.readFile(file, 'utf8'))
  rows.push({ name, label, data })
}

const report = render(rows)

if (outputFile) {
  await fs.mkdir(path.dirname(outputFile), { recursive: true })
  await fs.writeFile(outputFile, report)
}

process.stdout.write(report)
