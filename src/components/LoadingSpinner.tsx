export default function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-spin rounded-full h-6 w-6 border-2 border-proudfoot-navy border-t-transparent ${className}`} />
  )
}
