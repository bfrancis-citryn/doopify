import crypto from 'node:crypto'

import { Prisma } from '@prisma/client'
import type { WebhookDeliveryStatus } from '@prisma/client'

import { centsToDollars } from '@/lib/money'
import { prisma } from '@/lib/prisma'
import { emitInternalEvent } from '@/server/events/dispatcher'

export const MAX_WEBHOOK_DELIVERY_ATTEMPTS = 4

const RETRY_BACKOFF_MS = [
  60 * 1000,
  5 * 60 * 1000,
  30 * 60 * 1000,
] as const

const webhookDeliveryListSelect = {
  id: true,
  provider: true,
  providerEventId: true,
  eventType: true,
  status: true,
  attempts: true,
  processedAt: true,
  lastError: true,
  payloadHash: true,
  rawPayload: true,
  nextRetryAt: true,
  lastRetriedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WebhookDeliverySelect

function normalizeProviderEventId(providerEventId: string | undefined, payloadHash: string) {
  const normalized = String(providerEventId || '').trim()
  return normalized || `unknown:${payloadHash.slice(0, 24)}`
}

function getRetryDelayMs(attempts: number) {
  return RETRY_BACKOFF_MS[Math.max(0, Math.min(attempts - 1, RETRY_BACKOFF_MS.length - 1))]
}

function getRetrySchedule(attempts: number, retryable: boolean, now = new Date()) {
  if (!retryable) {
    return {
      status: 'FAILED' as WebhookDeliveryStatus,
      nextRetryAt: null,
    }
  }

  if (attempts >= MAX_WEBHOOK_DELIVERY_ATTEMPTS) {
    return {
      status: 'RETRY_EXHAUSTED' as WebhookDeliveryStatus,
      nextRetryAt: null,
    }
  }

  return {
    status: 'RETRY_PENDING' as WebhookDeliveryStatus,
    nextRetryAt: new Date(now.getTime() + getRetryDelayMs(attempts)),
  }
}

function getReplayBlockers(delivery: Awaited<ReturnType<typeof getWebhookDeliveryById>>) {
  if (!delivery) return ['Webhook delivery not found']

  const blockers: string[] = []
  if (delivery.provider !== 'stripe') blockers.push('Replay is only supported for Stripe deliveries')
  if (delivery.providerEventId.startsWith('unknown:')) blockers.push('Replay requires a provider event id')
  if (!delivery.rawPayload) blockers.push('Replay requires a verified stored payload')
  if (delivery.status === 'SIGNATURE_FAILED') blockers.push('Signature failures are not replayable')

  return blockers
}

function getRetryBlockers(delivery: Awaited<ReturnType<typeof getWebhookDeliveryById>>) {
  const blockers = getReplayBlockers(delivery)
  if (!delivery) return blockers
  if (delivery.status === 'PROCESSED') blockers.push('Processed deliveries do not need retry')
  if (delivery.status === 'RETRY_EXHAUSTED') blockers.push('Retry attempts are exhausted')
  if (delivery.attempts >= MAX_WEBHOOK_DELIVERY_ATTEMPTS) blockers.push('Maximum attempts reached')

  return Array.from(new Set(blockers))
}

export async function getWebhookDeliveries(params: {
  provider?: string
  status?: WebhookDeliveryStatus
  eventType?: string
  search?: string
  page?: number
  pageSize?: number
}) {
  const {
    provider,
    status,
    eventType,
    search,
    page = 1,
    pageSize = 20,
  } = params
  const trimmedSearch = search?.trim()

  const where: Prisma.WebhookDeliveryWhereInput = {
    ...(provider ? { provider } : {}),
    ...(status ? { status } : {}),
    ...(eventType ? { eventType } : {}),
    ...(trimmedSearch
      ? {
          OR: [
            { providerEventId: { contains: trimmedSearch, mode: 'insensitive' } },
            { lastError: { contains: trimmedSearch, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [deliveries, total] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where,
      select: webhookDeliveryListSelect,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.webhookDelivery.count({ where }),
  ])

  return {
    deliveries: deliveries.map((delivery) => {
      const { rawPayload, ...safeDelivery } = delivery
      return {
        ...safeDelivery,
        hasVerifiedPayload: Boolean(rawPayload),
      }
    }),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export async function getWebhookDeliveryById(id: string) {
  return prisma.webhookDelivery.findUnique({
    where: { id },
  })
}

export function hashWebhookPayload(payload: string) {
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex')
}

export async function recordWebhookDeliveryAttempt(input: {
  provider: string
  providerEventId?: string
  eventType?: string
  payload: string
  rawPayload?: string
  isRetry?: boolean
}) {
  const payloadHash = hashWebhookPayload(input.payload)
  const providerEventId = normalizeProviderEventId(input.providerEventId, payloadHash)
  const eventType = String(input.eventType || 'unknown')
  const now = new Date()

  return prisma.webhookDelivery.upsert({
    where: {
      provider_providerEventId: {
        provider: input.provider,
        providerEventId,
      },
    },
    create: {
      provider: input.provider,
      providerEventId,
      eventType,
      payloadHash,
      status: 'RECEIVED',
      attempts: 1,
      rawPayload: input.rawPayload,
      nextRetryAt: null,
      lastRetriedAt: input.isRetry ? now : null,
    },
    update: {
      eventType,
      payloadHash,
      status: 'RECEIVED',
      attempts: { increment: 1 },
      lastError: null,
      nextRetryAt: null,
      ...(input.rawPayload ? { rawPayload: input.rawPayload } : {}),
      ...(input.isRetry ? { lastRetriedAt: now } : {}),
    },
  })
}

export async function storeVerifiedWebhookPayload(input: {
  provider: string
  providerEventId: string
  rawPayload: string
}) {
  return prisma.webhookDelivery.update({
    where: {
      provider_providerEventId: {
        provider: input.provider,
        providerEventId: input.providerEventId,
      },
    },
    data: {
      rawPayload: input.rawPayload,
      payloadHash: hashWebhookPayload(input.rawPayload),
    },
  })
}

export async function markWebhookDeliveryProcessed(input: {
  provider: string
  providerEventId: string
}) {
  const delivery = await prisma.webhookDelivery.update({
    where: {
      provider_providerEventId: {
        provider: input.provider,
        providerEventId: input.providerEventId,
      },
    },
    data: {
      status: 'PROCESSED',
      processedAt: new Date(),
      lastError: null,
      nextRetryAt: null,
    },
  })

  await emitInternalEvent('webhook.delivered', {
    direction: 'inbound',
    provider: delivery.provider,
    providerEventId: delivery.providerEventId,
    eventType: delivery.eventType,
    attempts: delivery.attempts,
  })

  return delivery
}

export async function markWebhookDeliveryFailed(input: {
  provider: string
  providerEventId: string
  status?: WebhookDeliveryStatus
  error: string
  retryable?: boolean
}) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: {
      provider_providerEventId: {
        provider: input.provider,
        providerEventId: input.providerEventId,
      },
    },
    select: {
      attempts: true,
    },
  })
  const schedule = input.status
    ? { status: input.status, nextRetryAt: null }
    : getRetrySchedule(delivery?.attempts ?? 1, input.retryable ?? true)

  const updated = await prisma.webhookDelivery.update({
    where: {
      provider_providerEventId: {
        provider: input.provider,
        providerEventId: input.providerEventId,
      },
    },
    data: {
      status: schedule.status,
      processedAt: null,
      lastError: input.error,
      nextRetryAt: schedule.nextRetryAt,
    },
  })

  await emitInternalEvent('webhook.failed', {
    direction: 'inbound',
    provider: updated.provider,
    providerEventId: updated.providerEventId,
    eventType: updated.eventType,
    error: input.error,
    attempts: updated.attempts,
    retryable: Boolean(schedule.nextRetryAt),
  })

  return updated
}

export async function claimWebhookDeliveryForRetry(id: string, now = new Date()) {
  const claim = await prisma.webhookDelivery.updateMany({
    where: {
      id,
      status: 'RETRY_PENDING',
      nextRetryAt: { lte: now },
    },
    data: {
      status: 'RECEIVED',
      attempts: { increment: 1 },
      lastRetriedAt: now,
      nextRetryAt: null,
      lastError: null,
    },
  })

  if (claim.count === 0) return null
  return getWebhookDeliveryById(id)
}

export async function getDueWebhookDeliveriesForRetry(limit = 10, now = new Date()) {
  return prisma.webhookDelivery.findMany({
    where: {
      status: 'RETRY_PENDING',
      nextRetryAt: { lte: now },
      rawPayload: { not: null },
      attempts: { lt: MAX_WEBHOOK_DELIVERY_ATTEMPTS },
    },
    orderBy: { nextRetryAt: 'asc' },
    take: limit,
  })
}

export async function getWebhookDeliveryDiagnostics(id: string) {
  const delivery = await getWebhookDeliveryById(id)
  if (!delivery) return null

  let parsedPayload: { data?: { object?: { id?: unknown } } } | null = null
  try {
    parsedPayload = delivery.rawPayload ? JSON.parse(delivery.rawPayload) : null
  } catch {
    parsedPayload = null
  }

  const paymentIntentId =
    typeof parsedPayload?.data?.object?.id === 'string' ? parsedPayload.data.object.id : null

  const [checkoutSession, payment] = paymentIntentId
    ? await Promise.all([
        prisma.checkoutSession.findUnique({
          where: { paymentIntentId },
          select: {
            id: true,
            status: true,
            email: true,
            totalCents: true,
            currency: true,
            failureReason: true,
            completedAt: true,
            updatedAt: true,
          },
        }),
        prisma.payment.findUnique({
          where: { stripePaymentIntentId: paymentIntentId },
          select: {
            id: true,
            orderId: true,
            status: true,
            amountCents: true,
            currency: true,
            createdAt: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                paymentStatus: true,
                fulfillmentStatus: true,
                totalCents: true,
                currency: true,
                createdAt: true,
              },
            },
          },
        }),
      ])
    : [null, null]

  const replayBlockers = getReplayBlockers(delivery)
  const retryBlockers = getRetryBlockers(delivery)

  const { rawPayload, ...safeDelivery } = delivery

  return {
    delivery: {
      ...safeDelivery,
      hasVerifiedPayload: Boolean(delivery.rawPayload),
      rawPayloadBytes: delivery.rawPayload ? Buffer.byteLength(delivery.rawPayload, 'utf8') : 0,
    },
    retryPolicy: {
      maxAttempts: MAX_WEBHOOK_DELIVERY_ATTEMPTS,
      canReplay: replayBlockers.length === 0,
      canRetry: retryBlockers.length === 0,
      replayBlockers,
      retryBlockers,
    },
    related: {
      paymentIntentId,
      checkoutSession,
      payment: payment
        ? {
            id: payment.id,
            orderId: payment.orderId,
            status: payment.status,
            amount: centsToDollars(payment.amountCents),
            amountCents: payment.amountCents,
            currency: payment.currency,
            createdAt: payment.createdAt,
          }
        : null,
      order: payment?.order ?? null,
    },
  }
}
