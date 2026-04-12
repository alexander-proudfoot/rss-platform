import sql from 'mssql'
import type { HttpRequest } from '@azure/functions'

const PROD_HOST = 'rss-platform.proudfoot.com' // Update after SWA provisioning

let prodPool: sql.ConnectionPool | null = null
let previewPool: sql.ConnectionPool | null = null

function parseConnectionString(connStr: string): sql.config {
  // ADO.NET connection string parser — handles double-quoted values (SqlConnectionStringBuilder
  // format) so passwords/usernames containing ';' or '=' are parsed correctly.
  // Accepts both legacy ('Server','Database','User Id') and SqlConnectionStringBuilder
  // ('Data Source','Initial Catalog','User ID') key names.
  const parts = new Map<string, string>()
  let i = 0
  while (i < connStr.length) {
    while (i < connStr.length && connStr[i] === ';') i++
    if (i >= connStr.length) break
    const kStart = i
    while (i < connStr.length && connStr[i] !== '=') i++
    const key = connStr.slice(kStart, i).trim().toLowerCase()
    i++ // skip '='
    let val: string
    if (i < connStr.length && connStr[i] === '"') {
      i++ // skip opening quote
      let raw = ''
      while (i < connStr.length) {
        if (connStr[i] === '"' && connStr[i + 1] === '"') { raw += '"'; i += 2 } // escaped quote
        else if (connStr[i] === '"') { i++; break } // closing quote
        else { raw += connStr[i++] }
      }
      val = raw
    } else {
      const vStart = i
      while (i < connStr.length && connStr[i] !== ';') i++
      val = connStr.slice(vStart, i).trim()
    }
    if (key) parts.set(key, val)
  }
  const rawServer = parts.get('server') || parts.get('data source') || ''
  const server = rawServer.replace(/^tcp:/i, '').split(',')[0]
  const port = parseInt(rawServer.split(',')[1] || '1433', 10)
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
