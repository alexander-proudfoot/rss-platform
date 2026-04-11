import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { getJob } from '../lib/jobs.js'
import { query } from '../lib/db.js'

async function getJobStatus(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const jobId = req.params.jobId
  if (!jobId) return { status: 400 }

  const job = await getJob(jobId, req)
  if (!job) return { status: 404 }

  // Verify job belongs to user
  const ownership = await query<{ id: string } & Record<string, unknown>>(
    `SELECT sp.id FROM salesperson_profiles sp WHERE sp.id = @salespersonId AND sp.user_oid = @userOid`,
    { salespersonId: job.salesperson_id, userOid: principal.userId },
    req,
  )
  if (ownership.recordset.length === 0) return { status: 404 }

  if (job.status === 'complete') {
    return {
      status: 200,
      jsonBody: {
        status: 'complete',
        result: job.result_json ? JSON.parse(job.result_json) : null,
        completedAt: job.completed_at,
      },
    }
  }

  if (job.status === 'failed') {
    return {
      status: 200,
      jsonBody: { status: 'failed', error: job.error_message },
    }
  }

  return { status: 200, jsonBody: { status: job.status } }
}

app.http('getJobStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'jobs/{jobId}',
  handler: getJobStatus,
})
