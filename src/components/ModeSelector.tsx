import type { CoachingMode } from '../types'

const modes: Array<{ value: CoachingMode; label: string; description: string }> = [
  { value: 'pre-call', label: 'Pre-Call Coaching', description: 'Prepare for an upcoming customer interaction' },
  { value: 'post-call', label: 'Post-Call Debrief', description: 'Debrief after a customer interaction' },
  { value: 'dev-review', label: 'Development Review', description: 'Review your skill development progress' },
]

export default function ModeSelector({ selected, onSelect }: { selected: CoachingMode | null; onSelect: (mode: CoachingMode) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {modes.map(mode => (
        <button
          key={mode.value}
          onClick={() => onSelect(mode.value)}
          className={`p-4 rounded-lg border text-left transition ${
            selected === mode.value ? 'border-proudfoot-cyan bg-[#02B4BF]/10' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="font-medium text-sm">{mode.label}</div>
          <div className="text-xs text-gray-500 mt-1">{mode.description}</div>
        </button>
      ))}
    </div>
  )
}
