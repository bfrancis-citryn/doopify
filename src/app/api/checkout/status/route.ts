import { err, ok } from '@/lib/api'
import { getCheckoutStatus } from '@/server/services/checkout.service'

export async function GET(req: Request) {
  const paymentIntentId = new URL(req.url).searchParams.get('payment_intent')
  if (!paymentIntentId) {
    return err('payment_intent is required')
  }

  try {
    const status = await getCheckoutStatus(paymentIntentId)
    return ok(status)
  } catch (error) {
    console.error('[GET /api/checkout/status]', error)
    return err('Failed to fetch checkout status', 500)
  }
}
