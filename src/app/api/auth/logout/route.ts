import { ok } from '@/lib/api'
import { clearAuthCookie, getAuthTokenFromCookieHeader } from '@/lib/auth'
import { logoutUser } from '@/server/services/auth.service'

export async function POST(req: Request) {
  const token = getAuthTokenFromCookieHeader(req.headers.get('cookie'))

  if (token) await logoutUser(token)

  const res = ok({ message: 'Logged out' })
  clearAuthCookie(res)
  return res
}
