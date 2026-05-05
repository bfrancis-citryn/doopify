import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import {
  disableTeamUser,
  reactivateTeamUser,
  updateTeamUserRole,
} from '@/server/services/team.service'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set_role'), role: z.enum(['OWNER', 'ADMIN', 'STAFF', 'VIEWER']) }),
  z.object({ action: z.literal('disable') }),
  z.object({ action: z.literal('reactivate') }),
])

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const { id } = await context.params

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return err(parsed.error.errors[0].message, 422)
  }

  const actor = { id: auth.user.id, email: auth.user.email, role: auth.user.role }

  try {
    let user
    if (parsed.data.action === 'set_role') {
      user = await updateTeamUserRole(id, parsed.data.role, actor)
    } else if (parsed.data.action === 'disable') {
      user = await disableTeamUser(id, actor)
    } else {
      user = await reactivateTeamUser(id, actor)
    }
    return ok({ user })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update user'
    return err(message, 400)
  }
}
