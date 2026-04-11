import sql from 'mssql'
import type { HttpRequest } from '@azure/functions'

const PROD_HOST = 'rss-platform.proudfoot.com' // Update after SWA provisioning

let prodPool: sql.ConnectionPool | null = null
let previewPool: sql.ConnectionPool | null = null

function parseConnectionString(connStr: string): sql.config {
  const parts = new Map<string, string>()
  for (const part of connStr.split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0) parts.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).trim())
  }
  const server = (parts.get('server') || '').replace('tcp:', '').split(',')[0]
  const port = parseInt((parts.get('server') || '').split(',')[1] || '1433', 10)
  return {
    server,
    port,
    database: parts.get('initial catalog') || parts.get('database') || '',
    user: parts.get('user id') || parts.get('uid') || '',
    password: parts.get('password') || parts.get('pwd') || '',
    options: { encrypt: true, trustServerCertificate: false },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  }
}

function isProd(req?: HttpRequest): boolean {
  if (!req) return true
  const originalUrl = req.headers.get('x-ms-original-url') || ''
  try {
    return new URL(originalUrl).hostname === PROD_HOST
  } catch {
    return true
  }
}

async function getPool(req?: HttpRequest): Promise<sql.ConnectionPool> {
  if (isProd(req)) {
    if (!prodPool) {
      const connStr = process.env.SQL_CONNECTION_STRING
      if (!connStr) throw new Error('SQL_CONNECTION_STRING is not set')
      prodPool = await new sql.ConnectionPool(parseConnectionString(connStr)).connect()
    }
    return prodPool
  }
  if (!previewPool) {
    const connStr = process.env.SQL_CONNECTION_STRING_PREVIEW || process.env.SQL_CONNECTION_STRING
    if (!connStr) throw new Error('SQL_CONNECTION_STRING is not set')
    previewPool = await new sql.ConnectionPool(parseConnectionString(connStr)).connect()
  }
  return previewPool
}

export async function query<T extends Record<string, unknown>>(
  sqlText: string,
  params?: Record<string, unknown>,
  req?: HttpRequest,
): Promise<sql.IResult<T>> {
  const pool = await getPool(req)
  const request = pool.request()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value)
    }
  }
  return request.query<T>(sqlText)
}
