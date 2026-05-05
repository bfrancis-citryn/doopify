import { err, ok } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import { revokeTeamInvite } from '@/server/services/team.service'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function DELETE(req: Request, context: RouteContext) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const { id } = await context.params

  try {
    await revokeTeamInvite(id)
    return ok({ revoked: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke invite'
    return err(message, 400)
  }
}
