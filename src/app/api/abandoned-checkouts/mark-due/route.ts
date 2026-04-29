import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { markDueCheckoutsAbandoned } from '@/server/services/abandoned-checkout.service'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const result = await markDueCheckoutsAbandoned()
    return ok(result)
  } catch (error) {
    console.error('[POST /api/abandoned-checkouts/mark-due]', error)
    return err('Failed to mark due abandoned checkouts', 500)
  }
}
