import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CoachingMode, CoachingMessage, SessionDetail } from '../../types'
import { apiFetch, pollJob } from '../../lib/api'
import ModeSelector from '../../components/ModeSelector'
import ChatMessage from '../../components/ChatMessage'
import ChatInput from '../../components/ChatInput'
import LoadingSpinner from '../../components/LoadingSpinner'

interface CreateSessionResponse {
  id: string
  mode: CoachingMode
}

interface SendMessageResponse {
  jobId: string
}

interface JobResult {
  text: string
}

export default function CoachingScreen() {
  const [searchParams] = useSearchParams()
  const [sessionId, setSessionId] = useState<string | null>(searchParams.get('session'))
  const [mode, setMode] = useState<CoachingMode | null>(null)
  const [messages, setMessages] = useState<CoachingMessage[]>([])
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const paramSession = searchParams.get('session')
    if (paramSession) {
      setSessionId(paramSession)
    }
  }, [searchParams])

  useEffect(() => {
    if (!sessionId) return
    setSessionLoading(true)
    apiFetch<SessionDetail>(`/api/sessions/${sessionId}`)
      .then(detail => {
        setMode(detail.mode)
        setMessages(detail.messages)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load session'))
      .finally(() => setSessionLoading(false))
  }, [sessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleModeSelect(selectedMode: CoachingMode) {
    setError(null)
    setSessionLoading(true)
    try {
      const session = await apiFetch<CreateSessionResponse>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ mode: selectedMode }),
      })
      setSessionId(session.id)
      setMode(selectedMode)
      setMessages([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setSessionLoading(false)
    }
  }

  async function handleSend(content: string) {
    if (!sessionId) return
    setError(null)
    setSending(true)

    const userMessage: CoachingMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMessage])

    try {
      const { jobId } = await apiFetch<SendMessageResponse>(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })

      const result = await pollJob<JobResult>(jobId)

      const assistantMessage: CoachingMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.text,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      setMessages(prev => prev.filter(m => m.id !== userMessage.id))
    } finally {
      setSending(false)
    }
  }

  function handleNewSession() {
    setSessionId(null)
    setMode(null)
    setMessages([])
    setError(null)
  }

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-lg font-semibold text-proudfoot-navy">Coaching Session</h2>
          {mode && (
            <p className="text-sm text-gray-500 mt-0.5">
              {mode === 'pre-call' && 'Pre-Call Coaching'}
              {mode === 'post-call' && 'Post-Call Debrief'}
              {mode === 'dev-review' && 'Development Review'}
            </p>
          )}
        </div>
        {sessionId && (
          <button
            onClick={handleNewSession}
            className="px-3 py-1.5 text-sm font-medium text-proudfoot-navy border border-proudfoot-navy rounded-lg hover:bg-proudfoot-navy hover:text-white transition"
          >
            New Session
          </button>
        )}
      </div>

      {/* Body */}
      {!sessionId ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-xl">
            <h3 className="text-base font-medium text-proudfoot-navy mb-1">Start a coaching session</h3>
            <p className="text-sm text-gray-500 mb-6">Select the type of coaching you need.</p>
            <ModeSelector selected={mode} onSelect={handleModeSelect} />
          </div>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.length === 0 && !sending && (
              <div className="text-center text-sm text-gray-400 pt-8">
                Session started. Send a message to begin coaching.
              </div>
            )}
            {messages.map(message => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-2">
                  <LoadingSpinner className="h-4 w-4" />
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mb-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Input */}
          <div className="px-6 py-4 border-t border-gray-200 bg-white">
            <ChatInput onSend={handleSend} disabled={sending} />
          </div>
        </>
      )}
    </div>
  )
}
