import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import { inviteTeamUser, listPendingInvites } from '@/server/services/team.service'

export const runtime = 'nodejs'

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['OWNER', 'ADMIN', 'STAFF', 'VIEWER']),
})

export async function GET(req: Request) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  try {
    const invites = await listPendingInvites()
    return ok({ invites })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list invites'
    return err(message, 500)
  }
}

export async function POST(req: Request) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return err(parsed.error.errors[0].message, 422)
  }

  try {
    const { invite, rawToken } = await inviteTeamUser({
      email: parsed.data.email,
      role: parsed.data.role,
      invitedById: auth.user.id,
    })

    return ok({ invite, inviteToken: rawToken }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send invite'
    return err(message, 400)
  }
}
