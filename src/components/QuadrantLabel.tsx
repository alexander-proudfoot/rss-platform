import type { Quadrant } from '../types'

const quadrantConfig: Record<Quadrant, { label: string; description: string; style: string }> = {
  Q1: {
    label: 'Q1',
    description: 'High Need, High Value',
    style: 'bg-[#02B4BF]/15 text-[#003A4D] border-[#02B4BF]/30',
  },
  Q2: {
    label: 'Q2',
    description: 'High Need, Low Value',
    style: 'bg-[#003A4D]/10 text-[#003A4D] border-[#003A4D]/20',
  },
  Q3: {
    label: 'Q3',
    description: 'Low Need, High Value',
    style: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  Q4: {
    label: 'Q4',
    description: 'Low Need, Low Value',
    style: 'bg-gray-50 text-gray-500 border-gray-200',
  },
}

export default function QuadrantLabel({ quadrant, showDescription = false }: { quadrant: Quadrant; showDescription?: boolean }) {
  const config = quadrantConfig[quadrant]
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border text-xs font-medium ${config.style}`}>
      <span>{config.label}</span>
      {showDescription && <span className="text-xs opacity-75">— {config.description}</span>}
    </span>
  )
}
