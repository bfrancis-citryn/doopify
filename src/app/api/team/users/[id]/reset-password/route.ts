import { err, ok } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import { requestPasswordReset } from '@/server/services/team.service'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const { id } = await context.params

  try {
    const { reset, rawToken } = await requestPasswordReset(id, {
      id: auth.user.id,
      email: auth.user.email,
      role: auth.user.role,
    })

    return ok({
      reset: {
        id: reset.id,
        userId: reset.userId,
        expiresAt: reset.expiresAt,
      },
      // Raw token returned to OWNER to share securely (not emailed automatically)
      resetToken: rawToken,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate reset link'
    return err(message, 400)
  }
}
