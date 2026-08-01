import { execFile } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const temporaryDirectory = await fs.mkdtemp(
  path.join(os.tmpdir(), 'binding-perf-reports-')
)

const reports = [
  {
    script: 'scripts/summarize-benchkit.js',
    input: 'results/benchkit',
    expected: 'results/benchkit-report.md'
  },
  {
    script: 'scripts/summarize-ablation.js',
    input: 'results/ablation',
    expected: 'results/request-snapshot-ablation.md'
  }
]

try {
  for (const [index, report] of reports.entries()) {
    const generated = path.join(temporaryDirectory, `${index}.md`)
    const child = execFile(
      process.execPath,
      [report.script, report.input, generated],
      { cwd: repoDir, stdio: 'ignore' }
    )
    const [code, signal] = await once(child, 'exit')

    if (code !== 0) {
      throw new Error(
        `${report.script} failed: code=${code} signal=${signal || 'none'}`
      )
    }

    const [actualText, expectedText] = await Promise.all([
      fs.readFile(generated, 'utf8'),
      fs.readFile(path.join(repoDir, report.expected), 'utf8')
    ])

    if (actualText !== expectedText) {
      throw new Error(
        `${report.expected} is stale; regenerate it with node ${report.script} ` +
          `${report.input} ${report.expected}`
      )
    }
  }
} finally {
  await fs.rm(temporaryDirectory, { recursive: true, force: true })
}

process.stdout.write('Generated reports are up to date.\n')
