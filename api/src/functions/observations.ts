import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'

interface ObservationRow extends Record<string, unknown> {
  id: string
  observation_date: string
  meeting_type: string
  unit_assessed: string
  score: number
  specific_behaviour: string
  created_at: string
}

async function listObservations(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const unitFilter = req.query.get('unit') ?? null
  const limitParam = req.query.get('limit')
  const limit = Math.min(limitParam ? parseInt(limitParam, 10) || 50 : 50, 200)

  const whereUnit = unitFilter ? 'AND ol.unit_assessed = @unit' : ''
  const result = await query<ObservationRow>(
    `SELECT TOP (@limit) ol.id, ol.observation_date, ol.meeting_type, ol.unit_assessed, ol.score, ol.specific_behaviour, ol.created_at
     FROM observation_log ol
     JOIN salesperson_profiles sp ON ol.salesperson_id = sp.id
     WHERE sp.user_oid = @userOid ${whereUnit}
     ORDER BY ol.observation_date DESC`,
    { userOid: principal.userId, limit, ...(unitFilter ? { unit: unitFilter } : {}) },
    req,
  )

  return { status: 200, jsonBody: result.recordset }
}

app.http('listObservations', { methods: ['GET'], authLevel: 'anonymous', route: 'profile/observations', handler: listObservations })
