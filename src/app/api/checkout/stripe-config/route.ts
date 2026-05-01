import { ok } from '@/lib/api'
import { getStripeRuntimeConnection } from '@/server/payments/stripe-runtime.service'

export const runtime = 'nodejs'

export async function GET() {
  const stripeRuntime = await getStripeRuntimeConnection()

  return ok({
    publishableKey: stripeRuntime.publishableKey,
    source: stripeRuntime.source,
    mode: stripeRuntime.mode,
  })
}