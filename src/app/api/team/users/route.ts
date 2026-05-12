import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import { createTeamUser, listTeamUsers } from '@/server/services/team.service'

export const runtime = 'nodejs'

const createSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z.enum(['OWNER', 'ADMIN', 'STAFF', 'VIEWER']),
})

export async function GET(req: Request) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  try {
    const users = await listTeamUsers()
    return ok({ users })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list users'
    console.error('[team.users.get] failed', {
      actorId: auth.user.id,
      actorRole: auth.user.role,
      message,
    })
    return err(message, 500)
  }
}

export async function POST(req: Request) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return err(parsed.error.errors[0].message, 422)
  }

  try {
    const user = await createTeamUser(parsed.data)
    return ok({ user }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create user'
    console.error('[team.users.post] failed', {
      actorId: auth.user.id,
      actorRole: auth.user.role,
      targetEmail: parsed.data.email,
      requestedRole: parsed.data.role,
      message,
    })
    return err(message, 400)
  }
}
