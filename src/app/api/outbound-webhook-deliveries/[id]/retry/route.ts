import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { retryOutboundWebhookDelivery } from '@/server/services/outbound-webhook.service'

export const runtime = 'nodejs'

interface Params { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const delivery = await retryOutboundWebhookDelivery(id)
    if (!delivery) return err('Outbound webhook delivery not found or not retryable', 404)
    return ok(delivery)
  } catch (error) {
    console.error('[POST /api/outbound-webhook-deliveries/[id]/retry]', error)
    return err('Failed to retry outbound webhook delivery', 500)
  }
}
