import { ok, err, getToken } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'

export async function GET(req: Request) {
  const token = getToken(req)
  if (!token) return err('Unauthorized', 401)

  const user = await getSessionUser(token)
  if (!user) return err('Invalid or expired session', 401)

  return ok({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  })
}
