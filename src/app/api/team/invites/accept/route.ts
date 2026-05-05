import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { setAuthCookie } from '@/lib/auth'
import { loginUser } from '@/server/services/auth.service'
import { acceptTeamInvite } from '@/server/services/team.service'

export const runtime = 'nodejs'

const schema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
})

export async function POST(req: Request) {
  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return err(parsed.error.errors[0].message, 422)
  }

  const { token, password, confirmPassword, firstName, lastName } = parsed.data

  if (password !== confirmPassword) {
    return err('Passwords do not match.', 422)
  }

  try {
    const user = await acceptTeamInvite({ rawToken: token, password, firstName, lastName })

    const { token: authToken, user: sessionUser } = await loginUser(user.email, password)
    const res = ok({ user: sessionUser })
    setAuthCookie(res, authToken)
    return res
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to accept invite'
    return err(message, 400)
  }
}
