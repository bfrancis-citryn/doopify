import { completeCheckoutFromPaymentIntent, markCheckoutSessionFailed } from '@/server/services/checkout.service'
import { type StripePaymentIntent, type StripeWebhookEvent, verifyStripeWebhookSignature } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const payload = await req.text()
  const signature = req.headers.get('stripe-signature')

  try {
    verifyStripeWebhookSignature(payload, signature)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook signature verification failed'
    return new Response(message, { status: 400 })
  }

  const event = JSON.parse(payload) as StripeWebhookEvent<StripePaymentIntent>

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await completeCheckoutFromPaymentIntent(event.data.object)
        break
      case 'payment_intent.payment_failed':
        await markCheckoutSessionFailed({
          paymentIntentId: event.data.object.id,
          reason: event.data.object.last_payment_error?.message ?? 'Payment failed',
        })
        break
      default:
        break
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[POST /api/webhooks/stripe]', error)
    return new Response('Webhook processing failed', { status: 500 })
  }
}
