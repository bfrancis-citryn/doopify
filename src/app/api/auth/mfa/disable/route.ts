import { err, ok } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import { disableOwnerMfa } from '@/server/services/mfa.service'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  try {
    await disableOwnerMfa(auth.user.id, auth.user)
    return ok({ disabled: true })
  } catch (error) {
    console.error('[POST /api/auth/mfa/disable]', error)
    const message = error instanceof Error ? error.message : 'Failed to disable MFA'
    return err(message, 400)
  }
}
