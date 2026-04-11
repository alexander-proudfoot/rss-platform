export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error((error as { error?: string }).error || `HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

const JOB_POLL_INTERVAL_MS = 2000
const JOB_POLL_TIMEOUT_MS = 5 * 60 * 1000

export async function pollJob<T>(jobId: string): Promise<T> {
  const startTime = Date.now()
  while (Date.now() - startTime < JOB_POLL_TIMEOUT_MS) {
    const status = await apiFetch<{ status: string; result?: T; error?: string }>(`/api/jobs/${jobId}`)

    if (status.status === 'complete') return status.result as T
    if (status.status === 'failed') throw new Error(status.error || 'Job failed')

    await new Promise(resolve => setTimeout(resolve, JOB_POLL_INTERVAL_MS))
  }
  throw new Error('Coaching response timed out')
}
