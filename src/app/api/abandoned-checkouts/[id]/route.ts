import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { getAbandonedCheckout } from '@/server/services/abandoned-checkout.service'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const checkout = await getAbandonedCheckout(id)
    if (!checkout) {
      return err('Abandoned checkout not found', 404)
    }

    return ok(checkout)
  } catch (error) {
    console.error('[GET /api/abandoned-checkouts/[id]]', error)
    return err('Failed to fetch abandoned checkout', 500)
  }
}
