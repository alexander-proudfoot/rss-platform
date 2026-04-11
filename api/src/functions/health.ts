import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  timestamp: string
  checks: {
    database: { status: 'ok' | 'error'; message?: string }
    managedAgent: { status: 'ok' | 'error'; message?: string }
  }
}

async function healthHandler(_req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const checks: HealthStatus['checks'] = {
    database: { status: 'ok' },
    managedAgent: { status: 'ok' },
  }

  // Check database connectivity
  try {
    // Use a variable to prevent TypeScript from resolving the module statically —
    // db.ts does not exist yet (created in Task 6). The dynamic import will fail
    // at runtime until then, which is handled by the catch block below.
    const dbModulePath = '../lib/db.js'
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { query } = await import(/* @vite-ignore */ dbModulePath)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await query('SELECT 1 AS ping')
  } catch (err) {
    checks.database = {
      status: 'error',
      message: err instanceof Error ? err.message : 'Database unreachable',
    }
  }

  // Check Managed Agent configuration
  if (!process.env.ANTHROPIC_API_KEY) {
    checks.managedAgent = { status: 'error', message: 'ANTHROPIC_API_KEY not set' }
  } else if (!process.env.MANAGED_AGENT_ID) {
    checks.managedAgent = { status: 'error', message: 'MANAGED_AGENT_ID not set' }
  } else if (!process.env.MANAGED_ENVIRONMENT_ID) {
    checks.managedAgent = { status: 'error', message: 'MANAGED_ENVIRONMENT_ID not set' }
  }

  const allOk = checks.database.status === 'ok' && checks.managedAgent.status === 'ok'
  const anyError = checks.database.status === 'error' && checks.managedAgent.status === 'error'

  const result: HealthStatus = {
    status: anyError ? 'unhealthy' : allOk ? 'healthy' : 'degraded',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    checks,
  }

  return { status: 200, jsonBody: result }
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: healthHandler,
})
