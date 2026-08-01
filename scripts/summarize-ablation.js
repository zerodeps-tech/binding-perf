import fs from 'node:fs/promises'
import path from 'node:path'

const MODES = [
  ['control', 'Старый путь'],
  ['static', 'Один переход, готовый снимок'],
  ['shape', 'Новые контейнеры и пять свойств'],
  ['names', 'Новые строки имён свойств'],
  ['method', 'Значение method'],
  ['url', 'Значение URL'],
  ['query', 'Значение query'],
  ['headers', 'Копирование заголовков'],
  ['params', 'Копирование параметров'],
  ['production', 'Production snapshot()']
]

function counter(summary, name) {
  const item = summary.counters.find(
    (entry) => entry.event === name && entry.status === 'counted'
  )

  if (!item) {
    throw new Error(`${name} is missing from ${summary.parameters.snapshotAblation}`)
  }

  return item.perOperation
}

function formatNumber(value, digits = 0) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false
  })
}

function formatSigned(value, digits = 0) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatNumber(value, digits)}`
}

function formatPct(value) {
  return `${value > 0 ? '+' : ''}${formatNumber(value, 2)}%`
}

async function readMode(inputDir, name, label) {
  const directory = path.join(inputDir, name)
  const summary = JSON.parse(
    await fs.readFile(path.join(directory, 'summary.json'), 'utf8')
  )
  const self = await fs.readFile(path.join(directory, 'perf-self.txt'), 'utf8')
  const requestSnapshot = self.match(/^\s*([0-9.]+)%.*RequestSnapshot/m)

  return {
    name,
    label,
    summary,
    instructions: counter(summary, 'instructions:u'),
    cycles: counter(summary, 'cycles:u'),
    requestSnapshotSelfPct: requestSnapshot
      ? Number(requestSnapshot[1])
      : null
  }
}

function render(rows, metadata) {
  const control = rows.find((row) => row.name === 'control')
  const staticRow = rows.find((row) => row.name === 'static')
  const production = rows.find((row) => row.name === 'production')
  const first = control.summary
  const system = first.system || metadata.system
  const productionParameters = production.summary.parameters
  const sourceRef =
    productionParameters.swmUwsSourceRef ||
    `${metadata.sourceRef}@${metadata.sourceCommit}`
  const nativeSha256 =
    productionParameters.nativeBinarySha256 || metadata.nativeBinarySha256
  const lines = [
    '# requestSnapshot diagnostic ablation',
    '',
    `- Node.js: ${system.node}`,
    `- Platform: ${system.platform}`,
    `- CPU: ${system.cpu}`,
    `- swm-uws source: ${sourceRef}`,
    `- Native binary SHA-256: \`${nativeSha256}\``,
    `- Scenario: async GET \`/base-async\`, 100 connections, pipelining 10, 4 workers`,
    `- Warmup: ${first.parameters.warmupSeconds}s`,
    `- Measurement: ${first.parameters.durationSeconds}s \`perf stat\` + ${first.parameters.durationSeconds}s \`perf record\` per mode`,
    `- CPU affinity: server ${first.parameters.serverCpu}, load generator ${first.parameters.clientCpuAffinity}`,
    '',
    'Каждый режим добавляет к предыдущему ещё одну часть `snapshot()`.',
    'Это последовательные диагностические запуски, а не основной парный RPS-бенчмарк.',
    '',
    '| Режим | Инструкций/запрос | Δ к предыдущему | Δ к контролю | Циклов/запрос | RPS | p95, мс | p99, мс | ELU | RSS, MiB |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  ]

  let previous = null
  for (const row of rows) {
    const load = row.summary.statLoad
    const metrics = row.summary.serverMetrics
    const deltaPrevious = previous
      ? formatSigned(row.instructions - previous.instructions)
      : 'n/a'
    const deltaControl = formatPct(
      ((row.instructions - control.instructions) / control.instructions) * 100
    )
    lines.push(
      `| ${row.label} | ${formatNumber(row.instructions)} | ${deltaPrevious} | ` +
        `${deltaControl} | ${formatNumber(row.cycles)} | ` +
        `${formatNumber(load.requests.averagePerSecond)} | ` +
        `${formatNumber(load.latencyMs.p95Ms, 2)} | ` +
        `${formatNumber(load.latencyMs.p99Ms, 2)} | ` +
        `${formatNumber(metrics.eluPct, 2)}% | ` +
        `${formatNumber(metrics.memMB.rssPeak, 2)} |`
    )
    previous = row
  }

  const crossingSaving = staticRow.instructions - control.instructions
  const materialization = production.instructions - staticRow.instructions
  const net = production.instructions - control.instructions
  const productionSelf = production.requestSnapshotSelfPct

  lines.push(
    '',
    '## Вывод',
    '',
    `Один переход с готовым снимком экономит ${formatNumber(Math.abs(crossingSaving))} инструкций на запрос.`,
    `Материализация production-снимка добавляет ${formatNumber(materialization)} инструкций.`,
    `Итоговая цена относительно старого пути: +${formatNumber(net)} инструкций на запрос.`,
    '',
    productionSelf === null
      ? 'Символ `RequestSnapshot` в self-профиле не найден.'
      : `Собственный кадр \`RequestSnapshot\` занимает ${formatNumber(productionSelf, 2)}% семплов production-профиля.`,
    'Остальная работа распределена по вызовам V8: созданию строк и свойств, аллокациям и смене карты объекта.',
    '',
    'В запросе этого сценария два заголовка, `Host` и `Connection`. Query пустой, параметров маршрута нет, поэтому этот прогон не оценивает их цену для непустых значений.'
  )

  return `${lines.join('\n')}\n`
}

const inputDir = path.resolve(process.argv[2] || 'results/ablation')
const outputFile = process.argv[3] ? path.resolve(process.argv[3]) : null
const rows = []
const metadata = JSON.parse(
  await fs.readFile(path.join(inputDir, 'metadata.json'), 'utf8')
)

for (const [name, label] of MODES) {
  rows.push(await readMode(inputDir, name, label))
}

const report = render(rows, metadata)

if (outputFile) {
  await fs.mkdir(path.dirname(outputFile), { recursive: true })
  await fs.writeFile(outputFile, report)
}

process.stdout.write(report)
