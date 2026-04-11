import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'

interface MatrixPositionRow extends Record<string, unknown> {
  id: string
  salesperson_id: string
  customer_name: string
  x_axis: number
  y_axis: number
  assessed_at: string
  notes: string | null
}

async function getMatrixPositions(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const customerFilter = req.query.get('customer') ?? null

  const profileResult = await query<{ id: string } & Record<string, unknown>>(
    'SELECT id FROM salesperson_profiles WHERE user_oid = @userOid',
    { userOid: principal.userId },
    req,
  )

  if (profileResult.recordset.length === 0) {
    return { status: 200, jsonBody: { history: [], currentPositions: [] } }
  }

  const salespersonId = profileResult.recordset[0].id

  const whereCustomer = customerFilter ? 'AND mp.customer_name = @customer' : ''
  const result = await query<MatrixPositionRow>(
    `SELECT mp.id, mp.salesperson_id, mp.customer_name, mp.x_axis, mp.y_axis, mp.assessed_at, mp.notes
     FROM matrix_positions mp
     WHERE mp.salesperson_id = @salespersonId ${whereCustomer}
     ORDER BY mp.assessed_at DESC`,
    { salespersonId, ...(customerFilter ? { customer: customerFilter } : {}) },
    req,
  )

  const mapRow = (row: MatrixPositionRow) => ({
    id: row.id,
    salespersonId: row.salesperson_id,
    customerName: row.customer_name,
    xAxis: row.x_axis,
    yAxis: row.y_axis,
    assessedAt: row.assessed_at,
    notes: row.notes,
  })

  const history = result.recordset.map(mapRow)

  // Build currentPositions: latest entry per customer
  const latestByCustomer = new Map<string, MatrixPositionRow>()
  for (const row of result.recordset) {
    // recordset is ordered DESC so first occurrence per customer is the latest
    if (!latestByCustomer.has(row.customer_name)) {
      latestByCustomer.set(row.customer_name, row)
    }
  }

  const currentPositions = Array.from(latestByCustomer.values()).map(mapRow)

  return { status: 200, jsonBody: { history, currentPositions } }
}

app.http('getMatrixPositions', { methods: ['GET'], authLevel: 'anonymous', route: 'matrix/positions', handler: getMatrixPositions })
