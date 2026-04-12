import type { RssUnit } from '../types'
import { RSS_UNIT_LABELS } from '../types'

const unitStyles: Record<RssUnit, string> = {
  unit_1_positioning: 'bg-[#003A4D]/10 text-[#003A4D]',
  unit_2_discovering: 'bg-[#02B4BF]/10 text-[#02B4BF]',
  unit_3_building: 'bg-[#003A4D]/20 text-[#003A4D]',
  unit_4_presenting: 'bg-[#02B4BF]/20 text-[#02B4BF]',
  unit_5_resolving_concerns: 'bg-gray-100 text-gray-700',
}

export default function UnitBadge({ unit }: { unit: RssUnit }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${unitStyles[unit]}`}>
      {RSS_UNIT_LABELS[unit]}
    </span>
  )
}
