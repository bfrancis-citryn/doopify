import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  getAbandonedCheckoutSecret,
  isAbandonedCheckoutCronAuthorized,
} from '@/server/abandoned-checkouts/auth'
import { sendDueRecoveryEmails } from '@/server/services/abandoned-checkout.service'

export const runtime = 'nodejs'

function parseLimit(url: string) {
  const { searchParams } = new URL(url)
  return Math.max(1, Math.min(200, Number(searchParams.get('limit') || 50)))
}

export async function POST(req: Request) {
  const hasSecretConfigured = !!getAbandonedCheckoutSecret()
  const isCronAuthorized = hasSecretConfigured && isAbandonedCheckoutCronAuthorized(req)

  if (!isCronAuthorized) {
    const auth = await requireAdmin(req)
    if (!auth.ok) {
      if (!hasSecretConfigured) {
        return err('Abandoned checkout secret is not configured', 503)
      }
      return auth.response
    }
  }

  try {
    const result = await sendDueRecoveryEmails({ limit: parseLimit(req.url) })
    return ok(result)
  } catch (error) {
    console.error('[POST /api/abandoned-checkouts/send-due]', error)
    return err('Failed to process due abandoned checkouts', 500)
  }
}
