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
  const params = { userOid: principal.userId, ...(customerFilter ? { customer: customerFilter } : {}) }

  // Paginated history: bounded at 200 rows, ordered newest-first
  const historyResult = await query<MatrixPositionRow>(
    `SELECT TOP 200 mp.id, mp.customer_name, mp.opportunity_name, mp.quadrant, mp.evidence, mp.assessed_at
     FROM matrix_positions mp
     JOIN salesperson_profiles sp ON mp.salesperson_id = sp.id
     WHERE sp.user_oid = @userOid ${whereCustomer}
     ORDER BY mp.assessed_at DESC`,
    params,
    req,
  )

  // Current positions: latest entry per customer, computed via window function so it is
  // never affected by the TOP 200 history window (a customer with no recent activity
  // would otherwise be silently dropped from this rollup).
  const currentResult = await query<MatrixPositionRow>(
    `SELECT id, customer_name, opportunity_name, quadrant, evidence, assessed_at
     FROM (
       SELECT mp.id, mp.customer_name, mp.opportunity_name, mp.quadrant, mp.evidence, mp.assessed_at,
              ROW_NUMBER() OVER (PARTITION BY mp.customer_name ORDER BY mp.assessed_at DESC) AS rn
       FROM matrix_positions mp
       JOIN salesperson_profiles sp ON mp.salesperson_id = sp.id
       WHERE sp.user_oid = @userOid ${whereCustomer}
     ) ranked
     WHERE rn = 1`,
    params,
    req,
  )

  return {
    status: 200,
    jsonBody: {
      history: historyResult.recordset,
      currentPositions: currentResult.recordset,
    },
  }
}

app.http('getMatrixPositions', { methods: ['GET'], authLevel: 'anonymous', route: 'matrix/positions', handler: getMatrixPositions })
