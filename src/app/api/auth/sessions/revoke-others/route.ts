import { err, ok } from '@/lib/api'
import { getAuthTokenFromCookieHeader } from '@/lib/auth'
import { revokeOtherSessions } from '@/server/services/auth.service'
import { recordAuditLogBestEffort } from '@/server/services/audit-log.service'
import { requireAuth } from '@/server/auth/require-auth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response

  const currentToken = getAuthTokenFromCookieHeader(req.headers.get('cookie'))
  if (!currentToken) {
    return err('Cannot identify current session.', 400)
  }

  try {
    const count = await revokeOtherSessions(auth.user.id, currentToken)

    await recordAuditLogBestEffort({
      action: 'auth.other_sessions_revoked',
      actor: { actorType: 'STAFF', actorId: auth.user.id, actorEmail: auth.user.email, actorRole: auth.user.role },
      resource: { type: 'User', id: auth.user.id },
      summary: `${count} other session(s) revoked for ${auth.user.email}`,
      snapshot: { count },
    })

    return ok({ revoked: count })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke sessions'
    return err(message, 500)
  }
}
