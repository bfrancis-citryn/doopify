import { err, ok } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import { resendTeamInvite } from '@/server/services/team.service'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const { id } = await context.params

  try {
    const { invite, rawToken } = await resendTeamInvite(id)
    return ok({ invite, inviteToken: rawToken })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resend invite'
    return err(message, 400)
  }
}
