import { err, ok } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import { getUserSessions, revokeUserSessions } from '@/server/services/team.service'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, context: RouteContext) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const { id } = await context.params

  try {
    const sessions = await getUserSessions(id)
    return ok({ sessions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load sessions'
    return err(message, 500)
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const { id } = await context.params

  try {
    const result = await revokeUserSessions(id, {
      id: auth.user.id,
      email: auth.user.email,
      role: auth.user.role,
    })
    return ok({ revoked: result.count })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke sessions'
    return err(message, 400)
  }
}
