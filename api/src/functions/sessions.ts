import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'
import { v4 as uuidv4 } from 'uuid'

interface SessionRow extends Record<string, unknown> {
  id: string
  mode: string
  customer_name: string | null
  opportunity_name: string | null
  summary: string | null
  started_at: string
  completed_at: string | null
}

async function createSession(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const body = await req.json() as { mode: string; customerName?: string; opportunityName?: string }
  if (!body.mode || !['pre-call', 'post-call', 'dev-review'].includes(body.mode)) {
    return { status: 400, jsonBody: { error: 'mode must be pre-call, post-call, or dev-review' } }
  }

  // Ensure salesperson profile exists (upsert)
  await query(
    `IF NOT EXISTS (SELECT 1 FROM salesperson_profiles WHERE user_oid = @userOid)
     INSERT INTO salesperson_profiles (id, user_oid, display_name, email)
     VALUES (@id, @userOid, @displayName, @email)`,
    { id: uuidv4(), userOid: principal.userId, displayName: principal.userDetails, email: principal.userDetails },
    req,
  )

  const profileResult = await query<{ id: string } & Record<string, unknown>>(
    'SELECT id FROM salesperson_profiles WHERE user_oid = @userOid',
    { userOid: principal.userId },
    req,
  )
  const salespersonId = profileResult.recordset[0].id

  const sessionId = uuidv4()
  await query(
    `INSERT INTO coaching_sessions (id, salesperson_id, mode, customer_name, opportunity_name, started_at)
     VALUES (@id, @salespersonId, @mode, @customerName, @opportunityName, GETUTCDATE())`,
    {
      id: sessionId,
      salespersonId,
      mode: body.mode,
      customerName: body.customerName || null,
      opportunityName: body.opportunityName || null,
    },
    req,
  )

  return { status: 201, jsonBody: { id: sessionId, mode: body.mode } }
}

async function listSessions(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const result = await query<SessionRow>(
    `SELECT cs.id, cs.mode, cs.customer_name, cs.opportunity_name, cs.summary, cs.started_at, cs.completed_at
     FROM coaching_sessions cs
     JOIN salesperson_profiles sp ON cs.salesperson_id = sp.id
     WHERE sp.user_oid = @userOid
     ORDER BY cs.started_at DESC`,
    { userOid: principal.userId },
    req,
  )

  return { status: 200, jsonBody: result.recordset }
}

async function getSession(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const sessionId = req.params.sessionId
  if (!sessionId) return { status: 400 }

  const result = await query<SessionRow & { salesperson_user_oid: string }>(
    `SELECT cs.*, sp.user_oid AS salesperson_user_oid
     FROM coaching_sessions cs
     JOIN salesperson_profiles sp ON cs.salesperson_id = sp.id
     WHERE cs.id = @sessionId`,
    { sessionId },
    req,
  )

  if (result.recordset.length === 0) return { status: 404 }
  if (result.recordset[0].salesperson_user_oid !== principal.userId) return { status: 403 }

  // Get messages for this session
  const messages = await query<{ id: string; role: string; content: string; created_at: string } & Record<string, unknown>>(
    'SELECT id, role, content, created_at FROM coaching_messages WHERE session_id = @sessionId ORDER BY created_at',
    { sessionId },
    req,
  )

  const session = result.recordset[0]
  return {
    status: 200,
    jsonBody: {
      id: session.id,
      mode: session.mode,
      customerName: session.customer_name,
      opportunityName: session.opportunity_name,
      summary: session.summary,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      messages: messages.recordset,
    },
  }
}

app.http('createSession', { methods: ['POST'], authLevel: 'anonymous', route: 'sessions', handler: createSession })
app.http('listSessions', { methods: ['GET'], authLevel: 'anonymous', route: 'sessions', handler: listSessions })
app.http('getSession', { methods: ['GET'], authLevel: 'anonymous', route: 'sessions/{sessionId}', handler: getSession })
