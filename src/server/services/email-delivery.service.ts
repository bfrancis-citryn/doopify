import { prisma } from '@/lib/prisma'
import { sendTransactionalEmail } from '@/server/email/provider'

export type EmailDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'BOUNCED' | 'COMPLAINED' | 'RETRYING' | 'RESEND_REQUESTED'

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

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : 'Email delivery failed'
}

function emailDeliveryClient() {
  return (prisma as any).emailDelivery
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
