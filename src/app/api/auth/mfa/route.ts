import { err, ok } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import { getOwnerMfaStatus } from '@/server/services/mfa.service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  try {
    const status = await getOwnerMfaStatus(auth.user.id)
    return ok(status)
  } catch (error) {
    console.error('[GET /api/auth/mfa]', error)
    return err('Failed to load MFA status', 500)
  }
}
