import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CoachingMode, CoachingSession } from '../../types'
import { useStore } from '../../lib/store'
import LoadingSpinner from '../../components/LoadingSpinner'

const MODE_LABELS: Record<CoachingMode, string> = {
  'pre-call': 'Pre-Call',
  'post-call': 'Post-Call',
  'dev-review': 'Dev Review',
}

const MODE_STYLES: Record<CoachingMode, string> = {
  'pre-call': 'bg-[#003A4D]/10 text-[#003A4D]',
  'post-call': 'bg-[#02B4BF]/10 text-[#02B4BF]',
  'dev-review': 'bg-gray-100 text-gray-600',
}

const ALL_MODES: Array<CoachingMode | 'all'> = ['all', 'pre-call', 'post-call', 'dev-review']

function ModeBadge({ mode }: { mode: CoachingMode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${MODE_STYLES[mode]}`}>
      {MODE_LABELS[mode]}
    </span>
  )
}

export default function HistoryScreen() {
  const sessions = useStore(s => s.sessions)
  const sessionsLoading = useStore(s => s.sessionsLoading)
  const loadSessions = useStore(s => s.loadSessions)
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [modeFilter, setModeFilter] = useState<CoachingMode | 'all'>('all')

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  if (sessionsLoading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    )
  }

  const filtered = sessions.filter(session => {
    const matchesMode = modeFilter === 'all' || session.mode === modeFilter
    const query = search.toLowerCase()
    const matchesSearch =
      !query ||
      (session.customerName?.toLowerCase().includes(query) ?? false) ||
      (session.opportunityName?.toLowerCase().includes(query) ?? false) ||
      (session.summary?.toLowerCase().includes(query) ?? false)
    return matchesMode && matchesSearch
  })

  function handleSessionClick(session: CoachingSession) {
    void navigate(`/coaching?session=${session.id}`)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-proudfoot-navy">Session History</h2>
        <p className="text-sm text-gray-500 mt-0.5">{sessions.length} session{sessions.length !== 1 ? 's' : ''} total</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by customer or opportunity..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-proudfoot-cyan focus:border-transparent"
        />
        <select
          value={modeFilter}
          onChange={e => setModeFilter(e.target.value as CoachingMode | 'all')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-proudfoot-cyan focus:border-transparent bg-white"
        >
          {ALL_MODES.map(m => (
            <option key={m} value={m}>
              {m === 'all' ? 'All modes' : MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {/* Session list */}
      {filtered.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-12">
          {sessions.length === 0
            ? 'No sessions yet. Start a coaching session to see your history.'
            : 'No sessions match your search.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(session => (
            <button
              key={session.id}
              onClick={() => handleSessionClick(session)}
              className="w-full text-left bg-white rounded-lg border border-gray-200 px-4 py-4 hover:border-proudfoot-cyan hover:shadow-sm transition group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ModeBadge mode={session.mode} />
                  {session.customerName && (
                    <span className="text-sm font-medium text-proudfoot-navy truncate">
                      {session.customerName}
                    </span>
                  )}
                  {session.opportunityName && (
                    <span className="text-sm text-gray-500 truncate">
                      &mdash; {session.opportunityName}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                  {new Date(session.startedAt).toLocaleDateString()}
                </span>
              </div>
              {session.summary && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{session.summary}</p>
              )}
              {session.completedAt && (
                <p className="text-xs text-gray-400 mt-1">
                  Completed {new Date(session.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
