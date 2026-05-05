import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { acceptPasswordReset } from '@/server/services/team.service'

export const runtime = 'nodejs'

const schema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmNewPassword: z.string().min(1, 'Confirm password is required'),
})

export async function POST(req: Request) {
  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return err(parsed.error.errors[0].message, 422)
  }

  const { token, newPassword, confirmNewPassword } = parsed.data

  if (newPassword !== confirmNewPassword) {
    return err('Passwords do not match.', 422)
  }

  try {
    await acceptPasswordReset(token, newPassword)
    return ok({ reset: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset password'
    return err(message, 400)
  }
}
