import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'
import { submitJob, executeJob } from '../lib/jobs.js'
import { createSession as createAgentSession, sendMessageToSession } from '../lib/managed-agent.js'
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

  // Submit job record and execute within invocation context.
  // The work is awaited (not fire-and-forget) to prevent Azure Functions
  // from recycling the process mid-execution.
  const messageContent = body.content
  const work = async (_jobId: string) => {
    let agentResponse
    if (session.agent_session_id) {
      agentResponse = await sendMessageToSession(session.agent_session_id, messageContent)
    } else {
      agentResponse = await createAgentSession(messageContent)
      await query(
        'UPDATE coaching_sessions SET agent_session_id = @agentSessionId WHERE id = @sessionId',
        { agentSessionId: agentResponse.sessionId, sessionId },
        req,
      )
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
    work,
    { content: messageContent },
    req,
  )

  // Execute the job within this invocation so the Functions runtime
  // keeps the process alive until completion
  await executeJob(jobId, work, req)

  return { status: 200, jsonBody: { jobId } }
}

app.http('sendMessage', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId}/messages',
  handler: sendMessage,
})
