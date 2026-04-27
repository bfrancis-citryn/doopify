import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    webhookDelivery: {
      upsert: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

import {
  getWebhookDeliveries,
  getWebhookDeliveryById,
  hashWebhookPayload,
  markWebhookDeliveryFailed,
  markWebhookDeliveryProcessed,
  recordWebhookDeliveryAttempt,
} from './webhook-delivery.service'

describe('webhook delivery service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      }),
      update: expect.objectContaining({
        status: 'RECEIVED',
        attempts: { increment: 1 },
        lastError: null,
      }),
    })
    expect(mocks.prisma.webhookDelivery.upsert.mock.calls[0][0].create.payloadHash).toBe(
      hashWebhookPayload('{"id":"evt_1","type":"payment_intent.succeeded"}')
    )
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
      },
    })
  })

  it('marks failed deliveries with status and last error details', async () => {
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
      },
    })
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
      orderBy: { updatedAt: 'desc' },
      skip: 5,
      take: 5,
    })
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
})
