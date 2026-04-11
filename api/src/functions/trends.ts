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
  rss_unit: string
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

  const profileResult = await query<{ id: string } & Record<string, unknown>>(
    'SELECT id FROM salesperson_profiles WHERE user_oid = @userOid',
    { userOid: principal.userId },
    req,
  )

  if (profileResult.recordset.length === 0) {
    return {
      status: 200,
      jsonBody: ALL_UNITS.map(unit => ({
        unit,
        currentScore: null,
        averageScore: null,
        observationCount: 0,
        trend: 'insufficient_data' as TrendClassification,
        scoreHistory: [],
      })),
    }
  }

  const salespersonId = profileResult.recordset[0].id

  const result = await query<ObservationScoreRow>(
    `SELECT rss_unit, score, observation_date
     FROM skill_observations
     WHERE salesperson_id = @salespersonId AND score IS NOT NULL
     ORDER BY observation_date ASC`,
    { salespersonId },
    req,
  )

  const byUnit = new Map<string, { score: number; observation_date: string }[]>()
  for (const unit of ALL_UNITS) byUnit.set(unit, [])

  for (const row of result.recordset) {
    const list = byUnit.get(row.rss_unit)
    if (list) list.push({ score: row.score, observation_date: row.observation_date })
  }

  const trends = ALL_UNITS.map(unit => {
    const observations = byUnit.get(unit) ?? []
    const scores = observations.map(o => o.score)

    const currentScore = scores.length > 0 ? scores[scores.length - 1] : null
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
    const trend = classifyTrend(scores)

    return {
      unit,
      currentScore,
      averageScore: averageScore !== null ? Math.round(averageScore * 100) / 100 : null,
      observationCount: scores.length,
      trend,
      scoreHistory: observations.map(o => ({ score: o.score, observationDate: o.observation_date })),
    }
  })

  return { status: 200, jsonBody: trends }
}

app.http('getTrends', { methods: ['GET'], authLevel: 'anonymous', route: 'profile/trends', handler: getTrends })
