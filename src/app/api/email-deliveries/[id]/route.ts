import { err, ok } from '@/lib/api'
import { getEmailDeliveryById } from '@/server/services/email-delivery.service'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params

  try {
    const delivery = await getEmailDeliveryById(id)
    if (!delivery) {
      return err('Email delivery not found', 404)
    }

    return ok(delivery)
  } catch (error) {
    console.error('[GET /api/email-deliveries/[id]]', error)
    return err('Failed to fetch email delivery', 500)
  }
}
