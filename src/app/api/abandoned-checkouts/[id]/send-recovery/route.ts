import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { sendRecoveryEmailForCheckout } from '@/server/services/abandoned-checkout.service'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const result = await sendRecoveryEmailForCheckout(id, { respectCadence: false })
    if (!result.sent) {
      if (result.skippedReason === 'NOT_FOUND') {
        return err('Checkout session not found', 404)
      }

      const reasonMessages: Record<string, string> = {
        NOT_RECOVERABLE: 'Checkout is not recoverable',
        MISSING_EMAIL: 'Checkout does not have a recoverable email',
        ALREADY_RECOVERED: 'Checkout has already been recovered',
        MAX_SENDS_REACHED: 'Maximum recovery email sends reached for this checkout',
        NOT_DUE: 'Recovery email is not due yet',
        ALREADY_CLAIMED: 'Recovery email is already being sent by another worker',
      }

      return err(reasonMessages[result.skippedReason ?? ''] ?? 'Recovery email was skipped', 400)
    }

    return ok({ sent: true })
  } catch (error) {
    console.error('[POST /api/abandoned-checkouts/[id]/send-recovery]', error)
    return err('Failed to send recovery email', 500)
  }
}
