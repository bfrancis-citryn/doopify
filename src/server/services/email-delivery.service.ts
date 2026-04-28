import type { EmailDeliveryStatus as PrismaEmailDeliveryStatus, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { sendTransactionalEmail } from '@/server/email/provider'
import { buildOrderConfirmationEmailMessage } from '@/server/services/email-template.service'
import { getOrderById } from '@/server/services/order.service'

export const EMAIL_DELIVERY_STATUSES = [
  'PENDING',
  'SENT',
  'FAILED',
  'BOUNCED',
  'COMPLAINED',
  'RETRYING',
  'RESEND_REQUESTED',
] as const satisfies PrismaEmailDeliveryStatus[]

export type EmailDeliveryStatus = PrismaEmailDeliveryStatus

export const EMAIL_DELIVERY_RESEND_ELIGIBLE_STATUSES = [
  'FAILED',
  'BOUNCED',
  'COMPLAINED',
] as const satisfies EmailDeliveryStatus[]

type EmailDeliveryResendEligibleStatus = typeof EMAIL_DELIVERY_RESEND_ELIGIBLE_STATUSES[number]

const emailDeliveryListSelect = {
  id: true,
  event: true,
  template: true,
  recipientEmail: true,
  subject: true,
  status: true,
  provider: true,
  providerMessageId: true,
  attempts: true,
  lastError: true,
  nextRetryAt: true,
  sentAt: true,
  bouncedAt: true,
  complainedAt: true,
  orderId: true,
  customerId: true,
  refundId: true,
  returnId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EmailDeliverySelect

type EmailDeliveryListRecord = Prisma.EmailDeliveryGetPayload<{
  select: typeof emailDeliveryListSelect
}>

export type CreateEmailDeliveryInput = {
  event: string
  template: string
  recipientEmail: string
  subject: string
  provider?: string
  orderId?: string
  customerId?: string
  refundId?: string
  returnId?: string
}

export type SendTrackedEmailInput = CreateEmailDeliveryInput & {
  from: string
  html: string
}

export type EmailDeliveryDiagnostics = {
  delivery: EmailDeliveryListRecord
  resendPolicy: {
    canResend: boolean
    eligibleStatuses: EmailDeliveryResendEligibleStatus[]
    blockers: string[]
  }
  related: {
    order: {
      id: string
      orderNumber: number
      status: string
      paymentStatus: string
      fulfillmentStatus: string
      total: number
      currency: string
      createdAt: Date
    } | null
  }
}

export type ResendEmailDeliveryResult =
  | { success: true; delivery: EmailDeliveryListRecord }
  | {
      success: false
      reason: 'NOT_FOUND' | 'NOT_RESENDABLE' | 'UNSUPPORTED_TEMPLATE' | 'MISSING_CONTEXT'
      message: string
      blockers?: string[]
    }

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : 'Email delivery failed'
}

function emailDeliveryClient() {
  return (prisma as any).emailDelivery
}

function hasResendEligibleStatus(status: EmailDeliveryStatus): status is EmailDeliveryResendEligibleStatus {
  return EMAIL_DELIVERY_RESEND_ELIGIBLE_STATUSES.includes(status as EmailDeliveryResendEligibleStatus)
}

function resendPolicyBlockers(delivery: Pick<EmailDeliveryListRecord, 'status' | 'template' | 'orderId'>) {
  const blockers: string[] = []

  if (!hasResendEligibleStatus(delivery.status)) {
    blockers.push('Only failed, bounced, or complained deliveries can be resent')
  }

  if (delivery.template !== 'order_confirmation') {
    blockers.push(`Template "${delivery.template}" does not support safe resend yet`)
  }

  if (!delivery.orderId) {
    blockers.push('Safe resend requires a linked order')
  }

  return blockers
}

export async function createEmailDelivery(input: CreateEmailDeliveryInput) {
  return emailDeliveryClient().create({
    data: {
      event: input.event,
      template: input.template,
      recipientEmail: input.recipientEmail,
      subject: input.subject,
      provider: input.provider ?? 'resend',
      status: 'PENDING',
      orderId: input.orderId,
      customerId: input.customerId,
      refundId: input.refundId,
      returnId: input.returnId,
    },
  })
}

export async function markEmailDeliverySent(input: {
  deliveryId: string
  provider: string
  providerMessageId?: string
}) {
  return emailDeliveryClient().update({
    where: { id: input.deliveryId },
    data: {
      status: 'SENT',
      provider: input.provider,
      providerMessageId: input.providerMessageId,
      sentAt: new Date(),
      lastError: null,
      attempts: { increment: 1 },
    },
  })
}

export async function markEmailDeliveryFailed(input: {
  deliveryId: string
  error: unknown
  retryable?: boolean
}) {
  return emailDeliveryClient().update({
    where: { id: input.deliveryId },
    data: {
      status: input.retryable ? 'RETRYING' : 'FAILED',
      lastError: normalizeError(input.error),
      attempts: { increment: 1 },
      nextRetryAt: input.retryable ? new Date(Date.now() + 1000 * 60 * 5) : null,
    },
  })
}

export async function sendTrackedEmail(input: SendTrackedEmailInput) {
  const delivery = await createEmailDelivery({
    event: input.event,
    template: input.template,
    recipientEmail: input.recipientEmail,
    subject: input.subject,
    provider: input.provider,
    orderId: input.orderId,
    customerId: input.customerId,
    refundId: input.refundId,
    returnId: input.returnId,
  })

  try {
    const result = await sendTransactionalEmail({
      from: input.from,
      to: [input.recipientEmail],
      subject: input.subject,
      html: input.html,
    })

    return markEmailDeliverySent({
      deliveryId: delivery.id,
      provider: result.provider,
      providerMessageId: result.providerMessageId,
    })
  } catch (error) {
    await markEmailDeliveryFailed({ deliveryId: delivery.id, error, retryable: false })
    throw error
  }
}

export async function getEmailDeliveries(input: {
  status?: EmailDeliveryStatus | 'ALL'
  page?: number
  pageSize?: number
}) {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, input.pageSize ?? 20))
  const where = input.status && input.status !== 'ALL' ? { status: input.status } : {}

  const [total, deliveries] = await Promise.all([
    emailDeliveryClient().count({ where }),
    emailDeliveryClient().findMany({
      where,
      select: emailDeliveryListSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return {
    deliveries,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export async function getEmailDeliveryById(id: string): Promise<EmailDeliveryDiagnostics | null> {
  const delivery = await emailDeliveryClient().findUnique({
    where: { id },
    select: emailDeliveryListSelect,
  })

  if (!delivery) {
    return null
  }

  const order = delivery.orderId
    ? await prisma.order.findUnique({
        where: { id: delivery.orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          fulfillmentStatus: true,
          total: true,
          currency: true,
          createdAt: true,
        },
      })
    : null

  const blockers = resendPolicyBlockers(delivery)

  return {
    delivery,
    resendPolicy: {
      canResend: blockers.length === 0,
      eligibleStatuses: [...EMAIL_DELIVERY_RESEND_ELIGIBLE_STATUSES],
      blockers,
    },
    related: {
      order,
    },
  }
}

export async function resendEmailDelivery(id: string): Promise<ResendEmailDeliveryResult> {
  const existing = await emailDeliveryClient().findUnique({
    where: { id },
    select: emailDeliveryListSelect,
  })

  if (!existing) {
    return { success: false, reason: 'NOT_FOUND', message: 'Email delivery not found' }
  }

  const blockers = resendPolicyBlockers(existing)
  if (blockers.length > 0) {
    return {
      success: false,
      reason: 'NOT_RESENDABLE',
      message: blockers[0],
      blockers,
    }
  }

  if (existing.template !== 'order_confirmation' || !existing.orderId) {
    return {
      success: false,
      reason: 'UNSUPPORTED_TEMPLATE',
      message: 'Only order confirmation deliveries support safe resend right now',
    }
  }

  const order = await getOrderById(existing.orderId)
  if (!order) {
    return {
      success: false,
      reason: 'MISSING_CONTEXT',
      message: 'The linked order could not be found for this email delivery',
    }
  }

  const shippingAddress = order.addresses.find((address) => address.type === 'SHIPPING')
  const message = await buildOrderConfirmationEmailMessage({
    orderId: order.id,
    orderNumber: order.orderNumber,
    email: existing.recipientEmail,
    currency: order.currency,
    total: order.total,
    items: order.items.map((item) => ({
      title: item.title,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      price: item.price,
    })),
    shippingAddress: shippingAddress
      ? {
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          address1: shippingAddress.address1,
          city: shippingAddress.city,
          province: shippingAddress.province,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country,
        }
      : null,
  })

  const delivery = await sendTrackedEmail({
    event: existing.event,
    template: existing.template,
    recipientEmail: existing.recipientEmail,
    subject: existing.subject || message.subject,
    from: message.from,
    html: message.html,
    provider: existing.provider,
    orderId: existing.orderId ?? undefined,
    customerId: existing.customerId ?? undefined,
    refundId: existing.refundId ?? undefined,
    returnId: existing.returnId ?? undefined,
  })

  return { success: true, delivery }
}
