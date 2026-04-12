import type { TrendDirection } from '../types'

const trendConfig: Record<TrendDirection, { label: string; color: string; arrow: string }> = {
  improving: { label: 'Improving', color: 'text-emerald-600', arrow: '\u2191' },
  plateauing: { label: 'Plateauing', color: 'text-proudfoot-cyan', arrow: '\u2192' },
  declining: { label: 'Declining', color: 'text-red-600', arrow: '\u2193' },
  insufficient_data: { label: 'Insufficient data', color: 'text-gray-400', arrow: '\u2014' },
}

export default function TrendIndicator({ trend }: { trend: TrendDirection }) {
  const config = trendConfig[trend]
  return (
    <span className={`text-sm font-medium ${config.color}`}>
      {config.arrow} {config.label}
    </span>
  )
}
