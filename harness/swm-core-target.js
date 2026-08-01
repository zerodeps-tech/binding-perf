import Server, { prepareHeaders } from '@swarmmachina/swm-core'
import { parseArgs } from '@swarmmachina/benchkit/orchestration'
import { TargetRuntime } from '@swarmmachina/benchkit/target'
import { getScenario } from './scenarios.js'

const runtime = new TargetRuntime({ metrics: true })
const args = parseArgs(
  process.argv,
  { host: '127.0.0.1', port: 3000, testName: 'base-async' },
  {
    '--host': (out, value) => {
      out.host = String(value)
    },
    '--port': (out, value) => {
      out.port = Number(value)
    },
    '--test': (out, value) => {
      out.testName = String(value)
    }
  }
)

const scenario = getScenario(args.testName)
const preparedHeaders = prepareHeaders({
  'content-type': 'text/plain; charset=utf-8',
  'cache-control': 'no-store',
  'x-trace-id': 'bench-trace-id',
  'x-response-id': 'bench-response-id',
  'set-cookie': [
    'bench.access=1; Path=/; HttpOnly; SameSite=Lax',
    'bench.refresh=2; Path=/refresh; HttpOnly; SameSite=Lax'
  ]
})

async function asyncPayload() {
  return { ok: true }
}

function onRequest(ctx) {
  const method = ctx.method()
  const url = ctx.url()

  if (scenario.name === 'base-async' && method === 'get' && url === scenario.path) {
    return asyncPayload()
  }

  if (
    scenario.name === 'headers-prepared' &&
    method === 'get' &&
    url === scenario.path
  ) {
    return ctx.reply(200, preparedHeaders, 'ok')
  }

  if (scenario.name === 'post-base' && method === 'post' && url === scenario.path) {
    return ctx.json()
  }

  ctx.status(404)
  return 'Not Found'
}

const server = new Server({
  host: args.host,
  port: args.port,
  http: {
    onRequest,
    onError: console.error,
    maxBodySize: 1024 * 1024
  }
})

await server.listen()
runtime.registerShutdown(() => server.shutdown())
runtime.ready({ port: server.port })
