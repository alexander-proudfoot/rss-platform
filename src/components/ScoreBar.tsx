export default function ScoreBar({ score, max = 6 }: { score: number; max?: number }) {
  const pct = (score / max) * 100
  const color = score <= 2 ? 'bg-red-500' : score <= 4 ? 'bg-proudfoot-cyan' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium w-6 text-right">{score}</span>
    </div>
  )
}
