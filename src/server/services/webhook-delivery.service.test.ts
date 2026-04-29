import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    webhookDelivery: {
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    checkoutSession: {
      findUnique: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
    },
  },
  emitInternalEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))
vi.mock('@/server/events/dispatcher', () => ({
  emitInternalEvent: mocks.emitInternalEvent,
}))

import {
  getWebhookDeliveries,
  getWebhookDeliveryById,
  getWebhookDeliveryDiagnostics,
  getDueWebhookDeliveriesForRetry,
  hashWebhookPayload,
  MAX_WEBHOOK_DELIVERY_ATTEMPTS,
  claimWebhookDeliveryForRetry,
  markWebhookDeliveryFailed,
  markWebhookDeliveryProcessed,
  recordWebhookDeliveryAttempt,
  storeVerifiedWebhookPayload,
} from './webhook-delivery.service'

describe('webhook delivery service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.webhookDelivery.update.mockResolvedValue({
      id: 'delivery_1',
      provider: 'stripe',
      providerEventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
      status: 'PROCESSED',
      attempts: 1,
    })
  })

  it('records webhook delivery attempts with a durable payload hash', async () => {
    mocks.prisma.webhookDelivery.upsert.mockResolvedValue({
      id: 'delivery_1',
      provider: 'stripe',
      providerEventId: 'evt_1',
      status: 'RECEIVED',
      attempts: 1,
    })

    await recordWebhookDeliveryAttempt({
      provider: 'stripe',
      providerEventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
      payload: '{"id":"evt_1","type":"payment_intent.succeeded"}',
    })

    expect(mocks.prisma.webhookDelivery.upsert).toHaveBeenCalledWith({
      where: {
        provider_providerEventId: {
          provider: 'stripe',
          providerEventId: 'evt_1',
        },
      },
      create: expect.objectContaining({
        provider: 'stripe',
        providerEventId: 'evt_1',
        eventType: 'payment_intent.succeeded',
        status: 'RECEIVED',
        attempts: 1,
        nextRetryAt: null,
      }),
      update: expect.objectContaining({
        status: 'RECEIVED',
        attempts: { increment: 1 },
        lastError: null,
        nextRetryAt: null,
      }),
    })
    expect(mocks.prisma.webhookDelivery.upsert.mock.calls[0][0].create.payloadHash).toBe(
      hashWebhookPayload('{"id":"evt_1","type":"payment_intent.succeeded"}')
    )
  })

  it('stores verified payload only when requested', async () => {
    await storeVerifiedWebhookPayload({
      provider: 'stripe',
      providerEventId: 'evt_1',
      rawPayload: '{"id":"evt_1"}',
    })

    expect(mocks.prisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: {
        provider_providerEventId: {
          provider: 'stripe',
          providerEventId: 'evt_1',
        },
      },
      data: {
        rawPayload: '{"id":"evt_1"}',
        payloadHash: hashWebhookPayload('{"id":"evt_1"}'),
      },
    })
  })

  it('falls back to a deterministic unknown event id when provider event id is missing', async () => {
    mocks.prisma.webhookDelivery.upsert.mockResolvedValue({
      id: 'delivery_unknown',
      provider: 'stripe',
      providerEventId: 'unknown:abc',
      status: 'RECEIVED',
      attempts: 1,
    })

    await recordWebhookDeliveryAttempt({
      provider: 'stripe',
      eventType: 'unknown',
      payload: '{"invalid":true}',
    })

    const call = mocks.prisma.webhookDelivery.upsert.mock.calls[0][0]
    expect(call.where.provider_providerEventId.providerEventId).toMatch(/^unknown:[a-f0-9]{24}$/)
  })

  it('marks processed deliveries with timestamp and clears errors', async () => {
    await markWebhookDeliveryProcessed({
      provider: 'stripe',
      providerEventId: 'evt_1',
    })

    expect(mocks.prisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: {
        provider_providerEventId: {
          provider: 'stripe',
          providerEventId: 'evt_1',
        },
      },
      data: {
        status: 'PROCESSED',
        processedAt: expect.any(Date),
        lastError: null,
        nextRetryAt: null,
      },
    })
  })

  it('marks non-retryable failed deliveries with status and last error details', async () => {
    mocks.prisma.webhookDelivery.findUnique.mockResolvedValue({ attempts: 1 })

    await markWebhookDeliveryFailed({
      provider: 'stripe',
      providerEventId: 'evt_1',
      status: 'SIGNATURE_FAILED',
      error: 'Stripe webhook signature verification failed',
    })

    expect(mocks.prisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: {
        provider_providerEventId: {
          provider: 'stripe',
          providerEventId: 'evt_1',
        },
      },
      data: {
        status: 'SIGNATURE_FAILED',
        processedAt: null,
        lastError: 'Stripe webhook signature verification failed',
        nextRetryAt: null,
      },
    })
  })

  it('schedules retryable failures while attempts remain', async () => {
    mocks.prisma.webhookDelivery.findUnique.mockResolvedValue({ attempts: 2 })

    await markWebhookDeliveryFailed({
      provider: 'stripe',
      providerEventId: 'evt_retry',
      error: 'Order finalization failed',
      retryable: true,
    })

    expect(mocks.prisma.webhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RETRY_PENDING',
          lastError: 'Order finalization failed',
          nextRetryAt: expect.any(Date),
        }),
      })
    )
  })

  it('exhausts retryable failures after the maximum attempt count', async () => {
    mocks.prisma.webhookDelivery.findUnique.mockResolvedValue({ attempts: MAX_WEBHOOK_DELIVERY_ATTEMPTS })

    await markWebhookDeliveryFailed({
      provider: 'stripe',
      providerEventId: 'evt_exhausted',
      error: 'Still failing',
      retryable: true,
    })

    expect(mocks.prisma.webhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RETRY_EXHAUSTED',
          nextRetryAt: null,
        }),
      })
    )
  })

  it('returns paginated webhook deliveries with filters', async () => {
    mocks.prisma.webhookDelivery.findMany.mockResolvedValue([
      {
        id: 'delivery_1',
        provider: 'stripe',
        providerEventId: 'evt_1',
      },
    ])
    mocks.prisma.webhookDelivery.count.mockResolvedValue(1)

    const result = await getWebhookDeliveries({
      provider: 'stripe',
      status: 'FAILED',
      eventType: 'payment_intent.succeeded',
      search: 'evt_1',
      page: 2,
      pageSize: 5,
    })

    expect(mocks.prisma.webhookDelivery.findMany).toHaveBeenCalledWith({
      where: {
        provider: 'stripe',
        status: 'FAILED',
        eventType: 'payment_intent.succeeded',
        OR: [
          { providerEventId: { contains: 'evt_1', mode: 'insensitive' } },
          { lastError: { contains: 'evt_1', mode: 'insensitive' } },
        ],
      },
      select: expect.objectContaining({
        rawPayload: true,
      }),
      orderBy: { updatedAt: 'desc' },
      skip: 5,
      take: 5,
    })
    expect(result.deliveries[0]).toMatchObject({
      hasVerifiedPayload: false,
    })
    expect(result.deliveries[0]).not.toHaveProperty('rawPayload')
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 5,
      total: 1,
      totalPages: 1,
    })
  })

  it('loads a webhook delivery by id', async () => {
    mocks.prisma.webhookDelivery.findUnique.mockResolvedValue({
      id: 'delivery_1',
      provider: 'stripe',
      providerEventId: 'evt_1',
    })

    const delivery = await getWebhookDeliveryById('delivery_1')

    expect(mocks.prisma.webhookDelivery.findUnique).toHaveBeenCalledWith({
      where: { id: 'delivery_1' },
    })
    expect(delivery).toMatchObject({
      id: 'delivery_1',
      provider: 'stripe',
    })
  })

  it('loads due retry deliveries with verified payloads', async () => {
    const now = new Date('2026-04-28T12:00:00.000Z')
    mocks.prisma.webhookDelivery.findMany.mockResolvedValue([])

    await getDueWebhookDeliveriesForRetry(3, now)

    expect(mocks.prisma.webhookDelivery.findMany).toHaveBeenCalledWith({
      where: {
        status: 'RETRY_PENDING',
        nextRetryAt: { lte: now },
        rawPayload: { not: null },
        attempts: { lt: MAX_WEBHOOK_DELIVERY_ATTEMPTS },
      },
      orderBy: { nextRetryAt: 'asc' },
      take: 3,
    })
  })

  it('claims due retry deliveries before processing', async () => {
    const now = new Date('2026-04-28T12:00:00.000Z')
    mocks.prisma.webhookDelivery.updateMany.mockResolvedValue({ count: 1 })
    mocks.prisma.webhookDelivery.findUnique.mockResolvedValue({
      id: 'delivery_1',
      provider: 'stripe',
    })

    await claimWebhookDeliveryForRetry('delivery_1', now)

    expect(mocks.prisma.webhookDelivery.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'delivery_1',
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
  })

  it('returns diagnostics without exposing the raw payload', async () => {
    mocks.prisma.webhookDelivery.findUnique.mockResolvedValue({
      id: 'delivery_1',
      provider: 'stripe',
      providerEventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
      status: 'RETRY_PENDING',
      attempts: 2,
      processedAt: null,
      lastError: 'Order finalization failed',
      payloadHash: 'hash',
      rawPayload: JSON.stringify({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1',
          },
        },
      }),
      nextRetryAt: new Date('2026-04-28T12:05:00.000Z'),
      lastRetriedAt: null,
      createdAt: new Date('2026-04-28T12:00:00.000Z'),
      updatedAt: new Date('2026-04-28T12:01:00.000Z'),
    })
    mocks.prisma.checkoutSession.findUnique.mockResolvedValue({
      id: 'checkout_1',
      status: 'PENDING',
    })
    mocks.prisma.payment.findUnique.mockResolvedValue(null)

    const diagnostics = await getWebhookDeliveryDiagnostics('delivery_1')

    expect(diagnostics?.delivery).toMatchObject({
      id: 'delivery_1',
      hasVerifiedPayload: true,
    })
    expect(diagnostics?.delivery).not.toHaveProperty('rawPayload')
    expect(diagnostics?.related.paymentIntentId).toBe('pi_1')
    expect(diagnostics?.retryPolicy.canRetry).toBe(true)
  })
})
