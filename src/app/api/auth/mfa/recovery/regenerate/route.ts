import { err, ok } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import { regenerateOwnerRecoveryCodes } from '@/server/services/mfa.service'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  try {
    const result = await regenerateOwnerRecoveryCodes(auth.user.id, auth.user)
    return ok(result)
  } catch (error) {
    console.error('[POST /api/auth/mfa/recovery/regenerate]', error)
    const message = error instanceof Error ? error.message : 'Failed to regenerate recovery codes'
    return err(message, 400)
  }
}
