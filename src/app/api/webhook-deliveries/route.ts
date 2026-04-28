import type { WebhookDeliveryStatus } from '@prisma/client'

import { err, ok } from '@/lib/api'
import { getWebhookDeliveries } from '@/server/services/webhook-delivery.service'

const WEBHOOK_STATUSES: WebhookDeliveryStatus[] = [
  'RECEIVED',
  'PROCESSED',
  'FAILED',
  'SIGNATURE_FAILED',
  'RETRY_PENDING',
  'RETRY_EXHAUSTED',
]

function parseStatus(value: string | null): WebhookDeliveryStatus | undefined {
  if (!value) return undefined
  const normalized = value.toUpperCase() as WebhookDeliveryStatus
  return WEBHOOK_STATUSES.includes(normalized) ? normalized : undefined
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const deliveries = await getWebhookDeliveries({
      provider: searchParams.get('provider') || undefined,
      eventType: searchParams.get('eventType') || undefined,
      status: parseStatus(searchParams.get('status')),
      search: searchParams.get('search') || undefined,
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 20),
    })

    return ok(deliveries)
  } catch (error) {
    console.error('[GET /api/webhook-deliveries]', error)
    return err('Failed to fetch webhook deliveries', 500)
  }
}
