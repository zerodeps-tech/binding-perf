import fs from 'node:fs/promises'
import path from 'node:path'

const [resultsDirectory, sourceRef, sourceCommit, nativeBinarySha256, cpuGovernor] =
  process.argv.slice(2)

if (
  !resultsDirectory ||
  !sourceRef ||
  !sourceCommit ||
  !nativeBinarySha256 ||
  !cpuGovernor
) {
  throw new Error(
    'usage: node write-ablation-metadata.js ' +
      '<results-dir> <source-ref> <source-commit> <native-sha256> <governor>'
  )
}

const production = JSON.parse(
  await fs.readFile(
    path.join(resultsDirectory, 'production', 'summary.json'),
    'utf8'
  )
)

const metadata = {
  createdAt: new Date().toISOString(),
  system: production.system,
  sourceRef,
  sourceCommit,
  nativeBinarySha256,
  cpuGovernor,
  parameters: {
    connections: production.parameters.connections,
    pipelining: production.parameters.pipelining,
    workers: production.statLoad.parameters.workers,
    warmupSeconds: production.parameters.warmupSeconds,
    durationSeconds: production.parameters.durationSeconds,
    serverCpu: production.parameters.serverCpu,
    clientCpuAffinity: production.parameters.clientCpuAffinity
  }
}

await fs.writeFile(
  path.join(resultsDirectory, 'metadata.json'),
  `${JSON.stringify(metadata, null, 2)}\n`
)
