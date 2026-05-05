import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { setAuthCookie } from '@/lib/auth'
import { loginUser } from '@/server/services/auth.service'
import { activeOwnerExists, bootstrapOwner } from '@/server/services/team.service'

export const runtime = 'nodejs'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  setupToken: z.string().optional(),
})

export async function POST(req: Request) {
  // Immediately block if an owner already exists
  if (await activeOwnerExists()) {
    return err('Owner account already exists.', 409)
  }

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return err(parsed.error.errors[0].message, 422)
  }

  const { email, password, confirmPassword, firstName, lastName, setupToken } = parsed.data

  if (password !== confirmPassword) {
    return err('Passwords do not match.', 422)
  }

  try {
    await bootstrapOwner({ email, password, firstName, lastName, setupToken })

    // Sign in immediately after bootstrap
    const { token, user } = await loginUser(email, password)
    const res = ok({ user })
    setAuthCookie(res, token)
    return res
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create owner account'
    return err(message, 400)
  }
}

export async function GET() {
  const exists = await activeOwnerExists()
  return ok({ bootstrapAvailable: !exists })
}
