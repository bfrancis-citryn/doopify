import { err, ok } from '@/lib/api'
import { retryOutboundWebhookDelivery } from '@/server/services/outbound-webhook.service'

export const runtime = 'nodejs'

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
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
