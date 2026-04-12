import type { AuthUser } from '../types'

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const response = await fetch('/.auth/me')
    if (!response.ok) return null
    const data = await response.json() as { clientPrincipal: AuthUser | null }
    return data.clientPrincipal
  } catch {
    return null
  }
}

export function getLoginUrl(): string {
  return '/.auth/login/aad'
}

export function getLogoutUrl(): string {
  return '/.auth/logout'
}
