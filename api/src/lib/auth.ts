import type { HttpRequest } from '@azure/functions'

export interface ClientPrincipal {
  identityProvider: string
  userId: string       // AAD Object ID
  userDetails: string  // email
  userRoles: string[]
  claims?: Array<{ typ: string; val: string }>
}

export function getClientPrincipal(req: HttpRequest): ClientPrincipal | null {
  const header = req.headers.get('x-ms-client-principal')
  if (!header) return null
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf-8')) as ClientPrincipal
  } catch {
    return null
  }
}
