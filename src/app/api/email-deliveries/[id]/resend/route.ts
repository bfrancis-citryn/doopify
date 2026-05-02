import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { auditActorFromUser, recordAuditLogBestEffort } from '@/server/services/audit-log.service'
import {
  getEmailDeliveryById,
  resendEmailDelivery,
} from '@/server/services/email-delivery.service'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

type EmailDeliverySnapshot = Awaited<ReturnType<typeof getEmailDeliveryById>>

async function getEmailDeliverySnapshot(id: string): Promise<EmailDeliverySnapshot | null> {
  try {
    return await getEmailDeliveryById(id)
  } catch (error) {
    console.error('[POST /api/email-deliveries/[id]/resend] Failed to load audit snapshot', error)
    return null
  }
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const actor = auditActorFromUser(auth.user)

  try {
    const before = await getEmailDeliverySnapshot(id)
    const result = await resendEmailDelivery(id)

    if (!result.success) {
      await recordAuditLogBestEffort({
        action: 'email_delivery.resend_blocked',
        actor,
        resource: { type: 'EmailDelivery', id },
        summary: `Email resend was blocked for delivery ${id}`,
        snapshot: {
          outcome: 'blocked',
          reason: result.reason,
          blockers: result.blockers ?? [],
          originalStatus: before?.delivery.status ?? null,
          template: before?.delivery.template ?? null,
          recipientEmail: before?.delivery.recipientEmail ?? null,
          orderId: before?.delivery.orderId ?? null,
        },
        redactions: ['rendered email body', 'transport credentials'],
      })

      if (result.reason === 'NOT_FOUND') {
        return err(result.message, 404)
      }

      return err(result.message, 400)
    }

    await recordAuditLogBestEffort({
      action: 'email_delivery.resend_created',
      actor,
      resource: { type: 'EmailDelivery', id },
      summary: `Email resend created delivery ${result.delivery.id}`,
      snapshot: {
        outcome: 'created',
        originalDeliveryId: id,
        originalStatus: before?.delivery.status ?? null,
        template: before?.delivery.template ?? result.delivery.template,
        recipientEmail: before?.delivery.recipientEmail ?? result.delivery.recipientEmail,
        orderId: before?.delivery.orderId ?? result.delivery.orderId,
        newDeliveryId: result.delivery.id,
        newDeliveryStatus: result.delivery.status,
      },
      redactions: ['rendered email body', 'transport credentials'],
    })

    return ok(result.delivery)
  } catch (error) {
    console.error('[POST /api/email-deliveries/[id]/resend]', error)
    return err('Failed to resend email delivery', 500)
  }
}
