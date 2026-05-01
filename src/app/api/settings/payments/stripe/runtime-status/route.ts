import { err, ok } from '@/lib/api'
import {
  getStripeRuntimeConnection,
  getStripeWebhookSecretSelection,
} from '@/server/payments/stripe-runtime.service'
import { requireOwner } from '@/server/auth/require-auth'

export const runtime = 'nodejs'

function buildMessage(source: 'db' | 'env' | 'none') {
  if (source === 'db') return 'Checkout active source: DB verified connection.'
  if (source === 'env') return 'Checkout active source: .env fallback.'
  return 'Checkout is not configured. Add Stripe credentials in Settings -> Payments or env.'
}

export async function GET(req: Request) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  try {
    const stripeRuntime = await getStripeRuntimeConnection()
    const webhookSecretSelection = await getStripeWebhookSecretSelection()

    return ok({
      source: stripeRuntime.source,
      mode: stripeRuntime.mode,
      hasPublishableKey: Boolean(stripeRuntime.publishableKey),
      hasSecretKey: Boolean(stripeRuntime.secretKey),
      hasWebhookSecret: Boolean(webhookSecretSelection.webhookSecret),
      webhookSource: webhookSecretSelection.source,
      verified: stripeRuntime.verified,
      accountId: stripeRuntime.accountId,
      chargesEnabled: stripeRuntime.chargesEnabled,
      payoutsEnabled: stripeRuntime.payoutsEnabled,
      message: buildMessage(stripeRuntime.source),
    })
  } catch (error) {
    console.error('[GET /api/settings/payments/stripe/runtime-status]', error)
    return err('Failed to load Stripe runtime status', 500)
  }
}