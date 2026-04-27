import { type StripePaymentIntent, type StripeWebhookEvent } from '@/lib/stripe'
import { completeCheckoutFromPaymentIntent, markCheckoutSessionFailed } from '@/server/services/checkout.service'

export async function processStripeWebhookEvent(event: StripeWebhookEvent<StripePaymentIntent>) {
  switch (event.type) {
    case 'payment_intent.succeeded':
      await completeCheckoutFromPaymentIntent(event.data.object)
      return
    case 'payment_intent.payment_failed':
      await markCheckoutSessionFailed({
        paymentIntentId: event.data.object.id,
        reason: event.data.object.last_payment_error?.message ?? 'Payment failed',
      })
      return
    default:
      return
  }
}
