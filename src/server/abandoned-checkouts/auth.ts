import { env } from '@/lib/env'

export function getAbandonedCheckoutSecret() {
  return env.ABANDONED_CHECKOUT_SECRET ?? env.WEBHOOK_RETRY_SECRET ?? null
}

export function isAbandonedCheckoutCronAuthorized(req: Request) {
  const secret = getAbandonedCheckoutSecret()
  if (!secret) return false

  const authorization = req.headers.get('authorization')
  const bearer = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null
  const headerSecret = req.headers.get('x-abandoned-checkout-secret')
  const legacySecret = req.headers.get('x-webhook-retry-secret')

  return bearer === secret || headerSecret === secret || legacySecret === secret
}
