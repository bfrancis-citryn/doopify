import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { getAuthTokenFromCookieHeader, verifyToken } from '@/lib/auth'
import { changePassword } from '@/server/services/auth.service'
import { recordAuditLogBestEffort } from '@/server/services/audit-log.service'
import { requireAuth } from '@/server/auth/require-auth'

export const runtime = 'nodejs'

const schema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmNewPassword: z.string().min(1, 'Confirm password is required'),
})

export async function PATCH(req: Request) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return err(parsed.error.errors[0].message, 422)
  }

  const { currentPassword, newPassword, confirmNewPassword } = parsed.data

  if (newPassword !== confirmNewPassword) {
    return err('New passwords do not match.', 422)
  }

  if (newPassword === currentPassword) {
    return err('New password must differ from current password.', 422)
  }

  // Get the current session token to keep it alive after password change
  const currentToken = getAuthTokenFromCookieHeader(req.headers.get('cookie'))
  const payload = currentToken ? await verifyToken(currentToken) : null
  const currentSessionToken = payload ? currentToken : null

  try {
    await changePassword(auth.user.id, currentPassword, newPassword, currentSessionToken)

    await recordAuditLogBestEffort({
      action: 'auth.password_changed',
      actor: { actorType: 'STAFF', actorId: auth.user.id, actorEmail: auth.user.email, actorRole: auth.user.role },
      resource: { type: 'User', id: auth.user.id },
      summary: `Password changed for ${auth.user.email}`,
      redactions: ['currentPassword', 'newPassword', 'confirmNewPassword', 'passwordHash'],
    })

    return ok({ changed: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to change password'
    return err(message, 400)
  }
}
