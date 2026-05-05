import type { UserRole } from '@prisma/client'

import { err } from '@/lib/api'
import { getAuthTokenFromCookieHeader, getSessionUser } from '@/lib/auth'

export type RouteAuthUser = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
}

export type RouteAuthResult =
  | { ok: true; user: RouteAuthUser }
  | { ok: false; response: Response }

export async function requireAuth(req: Request): Promise<RouteAuthResult> {
  const token = getAuthTokenFromCookieHeader(req.headers.get('cookie'))

  if (!token) {
    return { ok: false, response: err('Unauthorized', 401) }
  }

  const user = await getSessionUser(token)

  if (!user) {
    return { ok: false, response: err('Invalid or expired session', 401) }
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  }
}

export async function requireRole(req: Request, roles: UserRole[]): Promise<RouteAuthResult> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth

  if (!roles.includes(auth.user.role)) {
    return { ok: false, response: err('Forbidden', 403) }
  }

  return auth
}

// OWNER + ADMIN + STAFF: standard admin access (orders, products, customers, etc.)
export function requireAdmin(req: Request) {
  return requireRole(req, ['OWNER', 'ADMIN', 'STAFF'])
}

// OWNER + ADMIN only: for ops that STAFF should not perform
export function requireAdminOrAbove(req: Request) {
  return requireRole(req, ['OWNER', 'ADMIN'])
}

export function requireOwner(req: Request) {
  return requireRole(req, ['OWNER'])
}
