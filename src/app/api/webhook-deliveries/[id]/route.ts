import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { getWebhookDeliveryDiagnostics } from '@/server/services/webhook-delivery.service'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const diagnostics = await getWebhookDeliveryDiagnostics(id)
    if (!diagnostics) {
      return err('Webhook delivery not found', 404)
    }

    return ok(diagnostics)
  } catch (error) {
    console.error('[GET /api/webhook-deliveries/[id]]', error)
    return err('Failed to fetch webhook delivery diagnostics', 500)
  }
}
