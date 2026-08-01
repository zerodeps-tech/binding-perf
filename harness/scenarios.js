const JSON_BODY = JSON.stringify({
  id: '00000000-0000-4000-8000-000000000000'
})

const SCENARIOS = new Map([
  [
    'base-async',
    {
      name: 'base-async',
      method: 'GET',
      path: '/base-async',
      connections: 100,
      pipelining: 10
    }
  ],
  [
    'headers-prepared',
    {
      name: 'headers-prepared',
      method: 'GET',
      path: '/headers-prepared',
      connections: 100,
      pipelining: 10
    }
  ],
  [
    'post-base',
    {
      name: 'post-base',
      method: 'POST',
      path: '/base',
      connections: 100,
      pipelining: 1,
      headers: { 'Content-Type': 'application/json' },
      body: JSON_BODY
    }
  ]
])

export function getScenario(name) {
  const scenario = SCENARIOS.get(name)

  if (!scenario) {
    throw new Error(
      `unknown scenario ${name}; expected ${[...SCENARIOS.keys()].join(', ')}`
    )
  }

  return {
    ...scenario,
    ...(scenario.headers ? { headers: { ...scenario.headers } } : {})
  }
}

export { JSON_BODY }
