import { useState } from 'react'

export default function ChatInput({ onSend, disabled = false, placeholder = 'Type your message...' }: { onSend: (message: string) => void; disabled?: boolean; placeholder?: string }) {
  const [value, setValue] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-proudfoot-cyan focus:border-transparent disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="px-4 py-2 bg-proudfoot-navy text-white rounded-lg text-sm font-medium hover:bg-proudfoot-slate disabled:opacity-50 transition"
      >
        Send
      </button>
    </form>
  )
}
