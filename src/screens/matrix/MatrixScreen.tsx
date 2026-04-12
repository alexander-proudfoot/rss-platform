import { useEffect } from 'react'
import type { Quadrant, MatrixPosition } from '../../types'
import { useStore } from '../../lib/store'
import QuadrantLabel from '../../components/QuadrantLabel'
import LoadingSpinner from '../../components/LoadingSpinner'

const QUADRANT_LAYOUT: Array<{ quadrant: Quadrant; colStart: number; rowStart: number; label: string; sublabel: string }> = [
  { quadrant: 'Q2', colStart: 1, rowStart: 1, label: 'Q2', sublabel: 'High Need, Low Value' },
  { quadrant: 'Q1', colStart: 2, rowStart: 1, label: 'Q1', sublabel: 'High Need, High Value' },
  { quadrant: 'Q4', colStart: 1, rowStart: 2, label: 'Q4', sublabel: 'Low Need, Low Value' },
  { quadrant: 'Q3', colStart: 2, rowStart: 2, label: 'Q3', sublabel: 'Low Need, High Value' },
]

function QuadrantCell({
  quadrant,
  sublabel,
  positions,
}: {
  quadrant: Quadrant
  sublabel: string
  positions: MatrixPosition[]
}) {
  const isHighValue = quadrant === 'Q1' || quadrant === 'Q3'
  const isHighNeed = quadrant === 'Q1' || quadrant === 'Q2'

  const bgClass = isHighNeed && isHighValue
    ? 'bg-[#02B4BF]/10 border-[#02B4BF]/30'
    : isHighNeed
    ? 'bg-[#003A4D]/5 border-[#003A4D]/20'
    : 'bg-gray-50 border-gray-200'

  return (
    <div className={`border rounded-lg p-4 min-h-[180px] flex flex-col ${bgClass}`}>
      <div className="flex items-center justify-between mb-3">
        <QuadrantLabel quadrant={quadrant} />
        <span className="text-xs text-gray-500">{sublabel}</span>
      </div>
      <div className="flex-1 space-y-1.5">
        {positions.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No customers</p>
        ) : (
          positions.map(pos => (
            <div key={pos.id} className="bg-white/70 rounded px-2 py-1.5 border border-white/80">
              <p className="text-xs font-medium text-proudfoot-navy truncate">{pos.customer_name}</p>
              {pos.opportunity_name && (
                <p className="text-xs text-gray-500 truncate">{pos.opportunity_name}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function MatrixScreen() {
  const matrixData = useStore(s => s.matrixData)
  const matrixLoading = useStore(s => s.matrixLoading)
  const loadMatrix = useStore(s => s.loadMatrix)

  useEffect(() => {
    void loadMatrix()
  }, [loadMatrix])

  if (matrixLoading && !matrixData) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    )
  }

  const currentPositions = matrixData?.currentPositions ?? []
  const history = matrixData?.history ?? []

  function getPositionsForQuadrant(q: Quadrant): MatrixPosition[] {
    return currentPositions.filter(p => p.quadrant === q)
  }

  const recentChanges = history.slice(0, 5)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-proudfoot-navy">Situational Matrix</h2>
        <p className="text-sm text-gray-500 mt-0.5">Customer positions across the 4 quadrants</p>
      </div>

      {/* Grid wrapper with axis labels */}
      <div className="relative">
        {/* Vertical axis label (Need) */}
        <div className="absolute -left-10 top-1/2 -translate-y-1/2 -rotate-90">
          <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase whitespace-nowrap">Need</span>
        </div>

        {/* Top axis labels */}
        <div className="grid grid-cols-[1fr_1fr] gap-0 mb-1 pl-0">
          <div className="text-center text-xs font-semibold text-gray-400 tracking-widest uppercase">Low Value</div>
          <div className="text-center text-xs font-semibold text-proudfoot-navy tracking-widest uppercase">High Value</div>
        </div>

        {/* 2x2 grid */}
        <div className="grid grid-cols-2 gap-3">
          {QUADRANT_LAYOUT.map(({ quadrant, sublabel }) => (
            <QuadrantCell
              key={quadrant}
              quadrant={quadrant}
              sublabel={sublabel}
              positions={getPositionsForQuadrant(quadrant)}
            />
          ))}
        </div>

        {/* Bottom axis labels */}
        <div className="grid grid-cols-[1fr_1fr] gap-0 mt-1">
          <div className="text-center text-xs font-semibold text-gray-400 tracking-widest uppercase">Low Need</div>
          <div className="text-center text-xs font-semibold text-gray-400 tracking-widest uppercase">Low Need</div>
        </div>
      </div>

      {/* Horizontal axis label (Value) */}
      <div className="text-center mt-1">
        <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Value</span>
      </div>

      {/* Recent position changes */}
      {recentChanges.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-proudfoot-navy mb-3">Recent Position Changes</h3>
          <div className="space-y-2">
            {recentChanges.map(pos => (
              <div key={pos.id} className="flex items-start gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
                <QuadrantLabel quadrant={pos.quadrant} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-proudfoot-navy truncate">{pos.customer_name}</p>
                  {pos.opportunity_name && (
                    <p className="text-xs text-gray-500 truncate">{pos.opportunity_name}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{pos.evidence}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(pos.assessed_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {matrixData && currentPositions.length === 0 && (
        <div className="mt-8 text-center text-sm text-gray-400">
          No customers placed yet. Complete a coaching session to position customers on the matrix.
        </div>
      )}
    </div>
  )
}
