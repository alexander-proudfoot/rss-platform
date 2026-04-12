import { useEffect } from 'react'
import type { RssUnit } from '../../types'
import { RSS_UNIT_LABELS } from '../../types'
import { useStore } from '../../lib/store'
import UnitBadge from '../../components/UnitBadge'
import ScoreBar from '../../components/ScoreBar'
import TrendIndicator from '../../components/TrendIndicator'
import LoadingSpinner from '../../components/LoadingSpinner'

const RSS_UNITS: RssUnit[] = [
  'unit_1_positioning',
  'unit_2_discovering',
  'unit_3_building',
  'unit_4_presenting',
  'unit_5_resolving_concerns',
]

function MiniBarChart({ scores }: { scores: Array<{ score: number; date: string }> }) {
  if (scores.length === 0) {
    return <span className="text-xs text-gray-400">No data</span>
  }
  const recent = scores.slice(-8)
  const max = 6
  return (
    <div className="flex items-end gap-0.5 h-8">
      {recent.map((s, i) => {
        const heightPct = (s.score / max) * 100
        return (
          <div
            key={i}
            className="w-3 bg-proudfoot-cyan/60 rounded-t"
            style={{ height: `${heightPct}%` }}
            title={`${s.score} on ${new Date(s.date).toLocaleDateString()}`}
          />
        )
      })}
    </div>
  )
}

export default function DashboardScreen() {
  const profile = useStore(s => s.profile)
  const profileLoading = useStore(s => s.profileLoading)
  const trends = useStore(s => s.trends)
  const trendsLoading = useStore(s => s.trendsLoading)
  const loadProfile = useStore(s => s.loadProfile)
  const loadTrends = useStore(s => s.loadTrends)

  useEffect(() => {
    void loadProfile()
    void loadTrends()
  }, [loadProfile, loadTrends])

  const isLoading = (profileLoading && !profile) || (trendsLoading && trends.length === 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    )
  }

  const focusUnit = profile?.current_focus_unit as RssUnit | null | undefined

  function getTrend(unit: RssUnit) {
    return trends.find(t => t.unit === unit)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-proudfoot-navy">Development Dashboard</h2>
        {profile && (
          <p className="text-sm text-gray-500 mt-0.5">{profile.display_name}</p>
        )}
      </div>

      {/* Focus unit banner */}
      {focusUnit && (
        <div className="mb-6 flex items-center gap-3 bg-[#02B4BF]/10 border border-proudfoot-cyan rounded-lg px-4 py-3">
          <div className="flex-1">
            <p className="text-xs font-semibold text-proudfoot-navy uppercase tracking-wide mb-1">Current Focus</p>
            <UnitBadge unit={focusUnit} />
          </div>
          <span className="text-xs text-gray-500">{RSS_UNIT_LABELS[focusUnit]}</span>
        </div>
      )}

      {/* Unit cards */}
      <div className="space-y-4">
        {RSS_UNITS.map(unit => {
          const trend = getTrend(unit)
          const isFocus = focusUnit === unit

          return (
            <div
              key={unit}
              className={`bg-white rounded-lg border p-4 ${isFocus ? 'border-proudfoot-cyan ring-1 ring-proudfoot-cyan' : 'border-gray-200'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <UnitBadge unit={unit} />
                {trend && <TrendIndicator trend={trend.trend} />}
              </div>

              {trend ? (
                <>
                  <div className="mb-3">
                    <ScoreBar score={trend.currentScore ?? trend.averageScore} />
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>
                      Current:{' '}
                      <span className="font-medium text-proudfoot-navy">
                        {trend.currentScore !== null ? trend.currentScore : '—'}
                      </span>
                    </span>
                    <span>
                      Average:{' '}
                      <span className="font-medium text-proudfoot-navy">
                        {trend.averageScore.toFixed(1)}
                      </span>
                    </span>
                    <span>
                      Observations:{' '}
                      <span className="font-medium text-proudfoot-navy">{trend.observationCount}</span>
                    </span>
                  </div>

                  <MiniBarChart scores={trend.scores} />
                </>
              ) : (
                <p className="text-xs text-gray-400 mt-2">No observations recorded yet.</p>
              )}
            </div>
          )
        })}
      </div>

      {trends.length === 0 && !trendsLoading && (
        <div className="mt-8 text-center text-sm text-gray-400">
          No development data yet. Complete coaching sessions to track your progress.
        </div>
      )}
    </div>
  )
}
