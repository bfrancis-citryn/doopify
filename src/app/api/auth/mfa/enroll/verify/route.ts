import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import { verifyOwnerMfaEnrollment } from '@/server/services/mfa.service'

export const runtime = 'nodejs'

const schema = z.object({
  code: z.string().min(6).max(32),
})

export async function POST(req: Request) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const result = await verifyOwnerMfaEnrollment(auth.user.id, parsed.data.code, auth.user)
    return ok(result)
  } catch (error) {
    console.error('[POST /api/auth/mfa/enroll/verify]', error)
    const message = error instanceof Error ? error.message : 'Failed to verify MFA enrollment'
    return err(message, 400)
  }
}
