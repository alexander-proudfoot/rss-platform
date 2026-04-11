import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'

interface MatrixPositionRow extends Record<string, unknown> {
  id: string
  customer_name: string
  opportunity_name: string | null
  quadrant: string
  evidence: string
  assessed_at: string
}

async function getMatrixPositions(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const customerFilter = req.query.get('customer') ?? null

  const whereCustomer = customerFilter ? 'AND mp.customer_name = @customer' : ''
  const result = await query<MatrixPositionRow>(
    `SELECT mp.id, mp.customer_name, mp.opportunity_name, mp.quadrant, mp.evidence, mp.assessed_at
     FROM matrix_positions mp
     JOIN salesperson_profiles sp ON mp.salesperson_id = sp.id
     WHERE sp.user_oid = @userOid ${whereCustomer}
     ORDER BY mp.assessed_at DESC`,
    { userOid: principal.userId, ...(customerFilter ? { customer: customerFilter } : {}) },
    req,
  )

  // Build currentPositions: latest entry per customer
  const latestByCustomer = new Map<string, MatrixPositionRow>()
  for (const row of result.recordset) {
    if (!latestByCustomer.has(row.customer_name)) {
      latestByCustomer.set(row.customer_name, row)
    }
  }

  return {
    status: 200,
    jsonBody: {
      history: result.recordset,
      currentPositions: Array.from(latestByCustomer.values()),
    },
  }
}

app.http('getMatrixPositions', { methods: ['GET'], authLevel: 'anonymous', route: 'matrix/positions', handler: getMatrixPositions })
