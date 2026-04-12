import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'
import { submitJob, executeJob } from '../lib/jobs.js'
import { createSessionOnly, sendMessageToSession } from '../lib/managed-agent.js'
import { v4 as uuidv4 } from 'uuid'

async function sendMessage(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const sessionId = req.params.sessionId
  if (!sessionId) return { status: 400 }

  const body = await req.json() as { content: string }
  if (!body.content?.trim()) return { status: 400, jsonBody: { error: 'content is required' } }

  // Verify session belongs to user
  const sessionResult = await query<{ id: string; agent_session_id: string | null; salesperson_id: string } & Record<string, unknown>>(
    `SELECT cs.id, cs.agent_session_id, cs.salesperson_id
     FROM coaching_sessions cs
     JOIN salesperson_profiles sp ON cs.salesperson_id = sp.id
     WHERE cs.id = @sessionId AND sp.user_oid = @userOid`,
    { sessionId, userOid: principal.userId },
    req,
  )
  if (sessionResult.recordset.length === 0) return { status: 404 }

  const session = sessionResult.recordset[0]

  // Save user message
  await query(
    `INSERT INTO coaching_messages (id, session_id, role, content, created_at)
     VALUES (@id, @sessionId, 'user', @content, GETUTCDATE())`,
    { id: uuidv4(), sessionId, content: body.content },
    req,
  )

  const messageContent = body.content
  const work = async (_jobId: string) => {
    let agentResponse
    if (session.agent_session_id) {
      agentResponse = await sendMessageToSession(session.agent_session_id, messageContent)
    } else {
      // Two-step pattern: create the session first (no message), then run the
      // IS NULL guard, then send the message only to the winning session.
      // This prevents double-send: createSession+send in one call meant the
      // losing concurrent request would send the message twice.
      const newSessionId = await createSessionOnly()
      const { rowsAffected } = await query(
        'UPDATE coaching_sessions SET agent_session_id = @agentSessionId WHERE id = @sessionId AND agent_session_id IS NULL',
        { agentSessionId: newSessionId, sessionId },
        req,
      )
      let winningSessionId: string
      if (rowsAffected[0] > 0) {
        winningSessionId = newSessionId
      } else {
        // Lost the race — newSessionId is orphaned at Anthropic (no DB record, never used).
        console.warn(`[messages] orphaned agent session ${newSessionId} — race lost for coaching session ${sessionId}`)
        const current = await query<{ agent_session_id: string }>(
          'SELECT agent_session_id FROM coaching_sessions WHERE id = @sessionId',
          { sessionId },
          req,
        )
        const existingId = current.recordset[0]?.agent_session_id
        if (!existingId) throw new Error('[session_error] Coaching session not found after concurrent creation race')
        winningSessionId = existingId
      }
      agentResponse = await sendMessageToSession(winningSessionId, messageContent)
    }

    // Save assistant message
    await query(
      `INSERT INTO coaching_messages (id, session_id, role, content, created_at)
       VALUES (@id, @sessionId, 'assistant', @content, GETUTCDATE())`,
      { id: uuidv4(), sessionId, content: agentResponse.text },
      req,
    )

    return JSON.stringify({ text: agentResponse.text })
  }

  const jobId = await submitJob(
    session.salesperson_id,
    sessionId,
    'coaching_message',
    { content: messageContent },
    req,
  )

  // Fire-and-forget: start agent work in the background, return 202 immediately.
  // executeJob handles its own errors internally (catches and sets job to 'failed').
  // The outer .catch() captures secondary failures (e.g. if the DB is also down
  // and executeJob's internal error-write fails) so they appear in Function logs.
  void executeJob(jobId, work, req).catch((err) => {
    console.error(`[jobs] executeJob secondary failure jobId=${jobId}:`, err)
  })

  return { status: 202, jsonBody: { jobId } }
}

app.http('sendMessage', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId}/messages',
  handler: sendMessage,
})
