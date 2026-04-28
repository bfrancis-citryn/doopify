import type { OrderConfirmationInput } from '@/server/services/email-template.service'
import { buildOrderConfirmationEmailMessage } from '@/server/services/email-template.service'
import { sendTrackedEmail } from '@/server/services/email-delivery.service'

export async function sendOrderConfirmationEmail(input: OrderConfirmationInput) {
  if (!input.email) {
    return
  }

  const message = await buildOrderConfirmationEmailMessage(input)

  return sendTrackedEmail({
    event: 'order.paid',
    template: 'order_confirmation',
    recipientEmail: input.email,
    subject: message.subject,
    from: message.from,
    html: message.html,
    orderId: input.orderId,
  })
}
