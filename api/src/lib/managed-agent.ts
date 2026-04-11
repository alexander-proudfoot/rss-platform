import Anthropic from '@anthropic-ai/sdk'

const BETA_HEADER = 'managed-agents-2026-04-01'
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
const POLL_INTERVAL_MS = 3000

export interface AgentResponse {
  text: string
  sessionId: string
}

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('[auth_error] ANTHROPIC_API_KEY is not set')
    client = new Anthropic({
      apiKey,
      defaultHeaders: { 'anthropic-beta': BETA_HEADER },
    })
  }
  return client
}

function getAgentId(): string {
  const id = process.env.MANAGED_AGENT_ID
  if (!id) throw new Error('[auth_error] MANAGED_AGENT_ID is not set')
  return id
}

function getEnvironmentId(): string {
  const id = process.env.MANAGED_ENVIRONMENT_ID
  if (!id) throw new Error('[auth_error] MANAGED_ENVIRONMENT_ID is not set')
  return id
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create a new Managed Agent session and send the first message.
 * Returns the agent's text response and the session ID for future messages.
 */
export async function createSession(
  userMessage: string,
  options?: { timeoutMs?: number },
): Promise<AgentResponse> {
  const anthropic = getClient()
  const agentId = getAgentId()
  const environmentId = getEnvironmentId()

  const session = await anthropic.beta.sessions.create({
    agent: agentId,
    environment_id: environmentId,
  })
  const sessionId = session.id

  return sendMessageToSession(sessionId, userMessage, options)
}

/**
 * Send a message to an existing Managed Agent session.
 * Used for multi-turn coaching conversations.
 */
export async function sendMessageToSession(
  sessionId: string,
  userMessage: string,
  options?: { timeoutMs?: number },
): Promise<AgentResponse> {
  const anthropic = getClient()
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  await anthropic.beta.sessions.events.send(sessionId, {
    events: [{
      type: 'user.message' as const,
      content: [{ type: 'text' as const, text: userMessage }],
    }],
  })

  // Poll until session is idle or terminated
  const startTime = Date.now()
  let sessionStatus = 'running'

  while (sessionStatus === 'running' || sessionStatus === 'rescheduling') {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('[timeout] Coaching session exceeded maximum duration')
    }
    await sleep(POLL_INTERVAL_MS)
    const current = await anthropic.beta.sessions.retrieve(sessionId)
    sessionStatus = current.status
  }

  if (sessionStatus === 'terminated') {
    const events = []
    for await (const event of anthropic.beta.sessions.events.list(sessionId)) {
      events.push(event)
    }
    const errorEvent = events.find(e => e.type === 'session.error')
    let errorMsg = 'Session terminated unexpectedly'
    if (errorEvent && errorEvent.type === 'session.error') {
      // Beta API shape may change -- use type assertion for error access
      errorMsg = (errorEvent as { type: 'session.error'; error: { message: string } }).error.message
    }
    throw new Error(`[session_error] ${errorMsg}`)
  }

  if (sessionStatus !== 'idle') {
    throw new Error(`[parse_error] Unexpected session status: ${sessionStatus}`)
  }

  // Extract text from agent.message events
  const allEvents = []
  for await (const event of anthropic.beta.sessions.events.list(sessionId)) {
    allEvents.push(event)
  }

  const textParts: string[] = []
  for (const event of allEvents) {
    if (event.type === 'agent.message') {
      for (const block of event.content) {
        if (block.type === 'text') {
          textParts.push(block.text)
        }
      }
    }
  }

  return { text: textParts.join('\n'), sessionId }
}
