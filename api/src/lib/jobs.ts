import { v4 as uuidv4 } from 'uuid'
import { query } from './db.js'
import type { HttpRequest } from '@azure/functions'

export interface AiJob extends Record<string, unknown> {
  id: string
  session_id: string | null
  salesperson_id: string
  job_type: string
  status: 'queued' | 'processing' | 'complete' | 'failed'
  request_json: string | null
  result_json: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export async function getJob(jobId: string, req?: HttpRequest): Promise<AiJob | null> {
  const result = await query<AiJob>(
    'SELECT * FROM ai_jobs WHERE id = @jobId',
    { jobId },
    req,
  )
  return result.recordset[0] || null
}

/**
 * Create a job record in the database and return the job ID.
 * The caller is responsible for executing the work via executeJob.
 */
export async function submitJob(
  salespersonId: string,
  sessionId: string | null,
  jobType: string,
  requestSnapshot?: unknown,
  req?: HttpRequest,
): Promise<string> {
  const jobId = uuidv4()

  await query(
    `INSERT INTO ai_jobs (id, salesperson_id, session_id, job_type, status, request_json, created_at)
     VALUES (@id, @salespersonId, @sessionId, @jobType, 'queued', @requestJson, GETUTCDATE())`,
    {
      id: jobId,
      salespersonId,
      sessionId,
      jobType,
      requestJson: requestSnapshot ? JSON.stringify(requestSnapshot) : null,
    },
    req,
  )

  return jobId
}

/**
 * Execute the work for a previously submitted job.
 * Safe to call as fire-and-forget: errors are caught internally and written to
 * the ai_jobs record as status 'failed' with a user-friendly message. If the
 * error-write itself fails (e.g. database is down), the job remains in 'processing'
 * status; the caller's outer .catch() should log that secondary failure.
 */
export async function executeJob(
  jobId: string,
  work: (jobId: string) => Promise<string>,
  req?: HttpRequest,
): Promise<void> {
  try {
    await query(
      `UPDATE ai_jobs SET status = 'processing' WHERE id = @id`,
      { id: jobId },
      req,
    )
    const resultJson = await work(jobId)
    await query(
      `UPDATE ai_jobs SET status = 'complete', result_json = @resultJson, completed_at = GETUTCDATE() WHERE id = @id`,
      { id: jobId, resultJson },
      req,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const lower = message.toLowerCase()
    let userMessage: string
    if (lower.includes('401') || lower.includes('authentication') || lower.includes('auth_error')) {
      userMessage = 'AI service not configured. Contact your administrator.'
    } else if (lower.includes('429') || lower.includes('rate_limit') || lower.includes('rate limit')) {
      userMessage = 'AI service is temporarily busy. Please try again in a few minutes.'
    } else if (lower.includes('timeout')) {
      userMessage = 'Coaching response timed out. Please try again.'
    } else {
      userMessage = 'Coaching generation failed. Please try again.'
    }
    // No .catch() here: if this write also fails, the error propagates up to executeJob's
    // caller (messages.ts outer .catch()) which logs it. Without propagation, executeJob
    // resolves successfully and the secondary DB failure is completely invisible.
    await query(
      `UPDATE ai_jobs SET status = 'failed', error_message = @errorMessage, completed_at = GETUTCDATE() WHERE id = @id`,
      { id: jobId, errorMessage: userMessage },
      req,
    )
  }
}
