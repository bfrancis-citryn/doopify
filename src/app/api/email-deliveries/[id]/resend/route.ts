import { err, ok } from '@/lib/api'
import { resendEmailDelivery } from '@/server/services/email-delivery.service'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params

  try {
    const result = await resendEmailDelivery(id)

    if (!result.success) {
      if (result.reason === 'NOT_FOUND') {
        return err(result.message, 404)
      }

      return err(result.message, 400)
    }

    return ok(result.delivery)
  } catch (error) {
    console.error('[POST /api/email-deliveries/[id]/resend]', error)
    return err('Failed to resend email delivery', 500)
  }
}
