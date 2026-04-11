import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'

const ALL_UNITS = [
  'unit_1_positioning',
  'unit_2_discovering',
  'unit_3_building',
  'unit_4_presenting',
  'unit_5_resolving_concerns',
] as const

type TrendClassification = 'insufficient_data' | 'improving' | 'declining' | 'plateauing'

interface ObservationScoreRow extends Record<string, unknown> {
  unit_assessed: string
  score: number
  observation_date: string
}

function classifyTrend(scores: number[]): TrendClassification {
  if (scores.length < 3) return 'insufficient_data'
  const last3 = scores.slice(-3)
  const range = Math.max(...last3) - Math.min(...last3)
  if (range <= 0.5) return 'plateauing'
  if (last3[2] > last3[0]) return 'improving'
  if (last3[2] < last3[0]) return 'declining'
  return 'plateauing'
}

async function getTrends(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const result = await query<ObservationScoreRow>(
    `SELECT ol.unit_assessed, ol.score, ol.observation_date
     FROM observation_log ol
     JOIN salesperson_profiles sp ON ol.salesperson_id = sp.id
     WHERE sp.user_oid = @userOid
     ORDER BY ol.observation_date ASC`,
    { userOid: principal.userId },
    req,
  )

  const byUnit = new Map<string, { score: number; date: string }[]>()
  for (const unit of ALL_UNITS) byUnit.set(unit, [])

  for (const row of result.recordset) {
    const list = byUnit.get(row.unit_assessed)
    if (list) list.push({ score: row.score, date: row.observation_date })
  }

  const trends = ALL_UNITS.map(unit => {
    const entries = byUnit.get(unit) ?? []
    const scores = entries.map(e => e.score)

    return {
      unit,
      currentScore: scores.length > 0 ? scores[scores.length - 1] : null,
      averageScore: scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : 0,
      observationCount: scores.length,
      trend: classifyTrend(scores),
      scores: entries,
    }
  })

  return { status: 200, jsonBody: trends }
}

app.http('getTrends', { methods: ['GET'], authLevel: 'anonymous', route: 'profile/trends', handler: getTrends })
