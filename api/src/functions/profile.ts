import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'

const VALID_FOCUS_UNITS = [
  'unit_1_positioning',
  'unit_2_discovering',
  'unit_3_building',
  'unit_4_presenting',
  'unit_5_resolving_concerns',
]

interface ProfileRow extends Record<string, unknown> {
  id: string
  user_oid: string
  display_name: string
  email: string
  current_focus_unit: string | null
  created_at: string
  updated_at: string
}

async function getProfile(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const result = await query<ProfileRow>(
    'SELECT id, user_oid, display_name, email, current_focus_unit, created_at, updated_at FROM salesperson_profiles WHERE user_oid = @userOid',
    { userOid: principal.userId },
    req,
  )

  if (result.recordset.length === 0) {
    return { status: 200, jsonBody: null }
  }

  const row = result.recordset[0]
  return {
    status: 200,
    jsonBody: {
      id: row.id,
      display_name: row.display_name,
      email: row.email,
      current_focus_unit: row.current_focus_unit,
      created_at: row.created_at,
    },
  }
}

async function updateFocusUnit(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const body = await req.json() as { focusUnit?: string | null }
  const focusUnit = body.focusUnit ?? null

  if (focusUnit !== null && !VALID_FOCUS_UNITS.includes(focusUnit)) {
    return {
      status: 400,
      jsonBody: { error: `focusUnit must be one of: ${VALID_FOCUS_UNITS.join(', ')}, or null` },
    }
  }

  const profileResult = await query<{ id: string } & Record<string, unknown>>(
    'SELECT id FROM salesperson_profiles WHERE user_oid = @userOid',
    { userOid: principal.userId },
    req,
  )

  if (profileResult.recordset.length === 0) return { status: 404 }

  await query(
    'UPDATE salesperson_profiles SET current_focus_unit = @focusUnit, updated_at = GETUTCDATE() WHERE user_oid = @userOid',
    { focusUnit, userOid: principal.userId },
    req,
  )

  return { status: 200, jsonBody: { focusUnit } }
}

app.http('getProfile', { methods: ['GET'], authLevel: 'anonymous', route: 'profile', handler: getProfile })
app.http('updateFocusUnit', { methods: ['PUT'], authLevel: 'anonymous', route: 'profile/focus-unit', handler: updateFocusUnit })
