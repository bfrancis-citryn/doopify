import { err, ok } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import { startOwnerMfaEnrollment } from '@/server/services/mfa.service'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  try {
    const enrollment = await startOwnerMfaEnrollment(auth.user.id)
    return ok(enrollment)
  } catch (error) {
    console.error('[POST /api/auth/mfa/enroll/start]', error)
    const message = error instanceof Error ? error.message : 'Failed to start MFA enrollment'
    return err(message, 400)
  }
}
