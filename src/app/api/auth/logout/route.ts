import { ok } from '@/lib/api'
import { clearAuthCookie } from '@/lib/auth'
import { logoutUser } from '@/server/services/auth.service'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') ?? ''
  const match = cookie.match(/doopify_token=([^;]+)/)
  const token = match ? match[1] : null

  if (token) await logoutUser(token)

  const res = ok({ message: 'Logged out' })
  clearAuthCookie(res)
  return res
}
