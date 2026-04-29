import type { OrderConfirmationInput } from '@/server/services/email-template.service'
import { queueOrderConfirmationEmailDelivery } from '@/server/services/email-delivery.service'

export async function sendOrderConfirmationEmail(input: OrderConfirmationInput) {
  if (!input.email || !input.orderId) {
    return
  }

  return queueOrderConfirmationEmailDelivery({
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    email: input.email,
  })
}
