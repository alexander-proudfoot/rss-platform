import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'

interface ObservationRow extends Record<string, unknown> {
  id: string
  salesperson_id: string
  session_id: string | null
  rss_unit: string
  score: number | null
  observation_text: string
  observation_date: string
}

async function listObservations(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const unitFilter = req.query.get('unit') ?? null
  const limitParam = req.query.get('limit')
  const limit = Math.min(limitParam ? parseInt(limitParam, 10) || 50 : 50, 200)

  const profileResult = await query<{ id: string } & Record<string, unknown>>(
    'SELECT id FROM salesperson_profiles WHERE user_oid = @userOid',
    { userOid: principal.userId },
    req,
  )

  if (profileResult.recordset.length === 0) return { status: 200, jsonBody: [] }

  const salespersonId = profileResult.recordset[0].id

  const whereUnit = unitFilter ? 'AND o.rss_unit = @unit' : ''
  const result = await query<ObservationRow>(
    `SELECT TOP (@limit) o.id, o.salesperson_id, o.session_id, o.rss_unit, o.score, o.observation_text, o.observation_date
     FROM skill_observations o
     WHERE o.salesperson_id = @salespersonId ${whereUnit}
     ORDER BY o.observation_date DESC`,
    { salespersonId, limit, ...(unitFilter ? { unit: unitFilter } : {}) },
    req,
  )

  return {
    status: 200,
    jsonBody: result.recordset.map(row => ({
      id: row.id,
      salespersonId: row.salesperson_id,
      sessionId: row.session_id,
      rssUnit: row.rss_unit,
      score: row.score,
      observationText: row.observation_text,
      observationDate: row.observation_date,
    })),
  }
}

app.http('listObservations', { methods: ['GET'], authLevel: 'anonymous', route: 'profile/observations', handler: listObservations })
