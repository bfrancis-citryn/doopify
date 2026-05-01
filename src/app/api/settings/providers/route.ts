import { err, ok } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import { listProviderStatuses } from '@/server/services/provider-connection.service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  try {
    const providers = await listProviderStatuses()
    return ok({ providers })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load provider statuses'
    console.error('[GET /api/settings/providers]', message)
    return err('Failed to load provider statuses', 500)
  }
}

