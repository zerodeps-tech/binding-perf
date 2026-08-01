import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import getFreePort from '@swarmmachina/benchkit/get-free-port'
import { terminateChildProcess } from '@swarmmachina/benchkit/managed-child-process'
import waitForMessage from '@swarmmachina/benchkit/wait-for-message'

const execFileAsync = promisify(execFile)
const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const targetPath = path.join(projectDir, 'harness', 'swm-core-target.js')
const SERVER_READY_TIMEOUT_MS = 60_000
const METRICS_TIMEOUT_MS = 15_000
const FAST_PATHS_BY_VARIANT = new Map([
  ['core-off', '0'],
  ['core-off-a', '0'],
  ['core-off-b', '0'],
  ['core-default', null],
  ['core-snapshot', 'requestSnapshot'],
  ['core-batch', 'responseBatch'],
  ['core-collect', 'collectBody'],
  ['core-all', 'all']
])

export default class SwmCoreServer {
  #variant
  #testName
  #serverCpu
  #workingDirectory
  #perfBasicProf
  #process = null
  #port = null
  #requestId = 0

  constructor({
    variant,
    testName,
    serverCpu = null,
    workingDirectory = projectDir,
    perfBasicProf = false
  }) {
    if (!FAST_PATHS_BY_VARIANT.has(variant)) {
      throw new Error(`unknown swm-core benchmark variant: ${variant}`)
    }
    if (!testName) {
      throw new Error('testName is required')
    }
    if (serverCpu !== null && (!Number.isInteger(serverCpu) || serverCpu < 0)) {
      throw new Error('serverCpu must be a non-negative integer or null')
    }

    this.#variant = variant
    this.#testName = testName
    this.#serverCpu = serverCpu
    this.#workingDirectory = path.resolve(workingDirectory)
    this.#perfBasicProf = perfBasicProf
  }

  get pid() {
    return this.#requireProcess().pid
  }

  get port() {
    if (this.#port === null) {
      throw new Error('swm-core server has not started')
    }
    return this.#port
  }

  async start() {
    if (this.#process) {
      throw new Error('swm-core server is already running')
    }

    await fs.access(targetPath)
    await fs.mkdir(this.#workingDirectory, { recursive: true })

    const port = await getFreePort()
    const nodeArgs = []
    if (this.#perfBasicProf) {
      nodeArgs.push(
        '--perf-basic-prof',
        '--perf-basic-prof-only-functions',
        '--interpreted-frames-native-stack'
      )
    }
    nodeArgs.push(targetPath, '--test', this.#testName, '--port', String(port))

    const env = { ...process.env }
    const fastPaths = FAST_PATHS_BY_VARIANT.get(this.#variant)
    if (fastPaths === null) {
      delete env.SWM_UWS_NATIVE_FAST_PATHS
    } else {
      env.SWM_UWS_NATIVE_FAST_PATHS = fastPaths
    }

    const child = spawn(process.execPath, nodeArgs, {
      cwd: this.#workingDirectory,
      env,
      stdio: ['ignore', 'inherit', 'inherit', 'ipc']
    })
    this.#process = child
    const ready = waitForMessage(
      child,
      (message) => message?.type === 'benchkit:ready',
      SERVER_READY_TIMEOUT_MS
    )

    try {
      const pin =
        this.#serverCpu === null
          ? Promise.resolve()
          : execFileAsync('taskset', [
              '-pc',
              String(this.#serverCpu),
              String(child.pid)
            ])
      const [, message] = await Promise.all([pin, ready])
      if (!message?.payload?.port) {
        throw new Error(`invalid ready message from ${this.#variant}`)
      }
      this.#port = message.payload.port
      return this
    } catch (error) {
      await this.stop()
      throw error
    }
  }

  async startMetrics(sampleMs) {
    await this.#request('benchkit:metrics:start', { sampleMs })
  }

  async stopMetrics() {
    return this.#request('benchkit:metrics:stop', {})
  }

  async stop() {
    const child = this.#process
    this.#process = null
    this.#port = null
    if (!child) {
      return
    }

    await terminateChildProcess(child, { graceMs: 2_000, killMs: 2_000 })
  }

  async #request(type, payload) {
    const child = this.#requireProcess()
    const id = `${child.pid}-${++this.#requestId}`
    const response = waitForMessage(
      child,
      (message) => message?.type === 'benchkit:response' && message.id === id,
      METRICS_TIMEOUT_MS
    )
    child.send?.({ type, id, payload })
    const message = await response

    if (message.status !== 'ok') {
      throw new Error(
        `${type} failed: ${message.error?.message || 'unknown target error'}`
      )
    }

    return message.payload
  }

  #requireProcess() {
    if (!this.#process) {
      throw new Error('swm-core server is not running')
    }
    return this.#process
  }
}
