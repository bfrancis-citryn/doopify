import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    integration: { findMany: vi.fn() },
    outboundWebhookDelivery: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  decrypt: vi.fn((value: string) => value),
  emitInternalEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/utils/crypto', () => ({ decrypt: mocks.decrypt }))
vi.mock('@/server/events/dispatcher', () => ({ emitInternalEvent: mocks.emitInternalEvent }))

import {
  createOutboundWebhookSignature,
  processDueOutboundDeliveries,
  processOutboundWebhook,
  queueOutboundWebhooks,
  retryOutboundWebhookDelivery,
} from './outbound-webhook.service'

describe('outbound webhook service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    global.fetch = vi.fn()
    mocks.prisma.outboundWebhookDelivery.updateMany.mockResolvedValue({ count: 1 })
  })

  it('creates timestamped HMAC signatures', () => {
    const signature = createOutboundWebhookSignature({
      payload: '{"hello":"world"}',
      secret: 'secret',
      timestamp: 123,
    })

    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/)
  })

  it('queues deliveries for active integrations subscribed to an event', async () => {
    mocks.prisma.integration.findMany.mockResolvedValue([{ id: 'int-1' }, { id: 'int-2' }])
    mocks.prisma.outboundWebhookDelivery.createMany.mockResolvedValue({ count: 2 })

    const result = await queueOutboundWebhooks('order.refunded', {
      orderId: 'order-1',
      orderNumber: 1001,
      refundId: 'refund-1',
      amount: 25,
      currency: 'USD',
    })

    expect(result).toEqual({ queued: 2 })
    expect(mocks.prisma.integration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          webhookUrl: { not: null },
          events: { some: { event: 'order.refunded' } },
        }),
      })
    )
    expect(mocks.prisma.outboundWebhookDelivery.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ integrationId: 'int-1', event: 'order.refunded', status: 'PENDING' }),
          expect.objectContaining({ integrationId: 'int-2', event: 'order.refunded', status: 'PENDING' }),
        ]),
      })
    )
  })

  it('claims, delivers signed payloads, and records success', async () => {
    vi.setSystemTime(new Date('2026-04-28T12:00:00.000Z'))
    vi.useFakeTimers()
    mocks.prisma.outboundWebhookDelivery.findUnique.mockResolvedValue({
      id: 'delivery-1',
      integrationId: 'int-1',
      event: 'order.paid',
      payload: '{"event":"order.paid"}',
      status: 'PENDING',
      attempts: 0,
      nextRetryAt: null,
      integration: {
        id: 'int-1',
        status: 'ACTIVE',
        webhookUrl: 'https://merchant.example/webhooks',
        webhookSecret: 'encrypted-secret',
        secrets: [{ key: 'HEADER_X-Test', value: 'header-value' }],
      },
    })
    mocks.prisma.outboundWebhookDelivery.update.mockResolvedValue({ id: 'delivery-1', status: 'SUCCESS' })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'ok',
    })

    const result = await processOutboundWebhook('delivery-1')

    expect(mocks.prisma.outboundWebhookDelivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'delivery-1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'RETRYING' }),
    }))
    expect(global.fetch).toHaveBeenCalledWith(
      'https://merchant.example/webhooks',
      expect.objectContaining({
        method: 'POST',
        body: '{"event":"order.paid"}',
        headers: expect.objectContaining({
          'X-Doopify-Delivery': 'delivery-1',
          'X-Doopify-Event': 'order.paid',
          'X-Doopify-Timestamp': '1777377600',
          'X-Doopify-Signature': expect.stringMatching(/^sha256=/),
          'X-Test': 'header-value',
        }),
      })
    )
    expect(mocks.prisma.outboundWebhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'delivery-1' },
        data: expect.objectContaining({ status: 'SUCCESS', attempts: 1, statusCode: 200, responseBody: 'ok', lastError: null }),
      })
    )
    expect(result).toEqual({ id: 'delivery-1', status: 'SUCCESS' })
  })

  it('skips delivery when another worker already claimed it', async () => {
    mocks.prisma.outboundWebhookDelivery.findUnique.mockResolvedValue({
      id: 'delivery-claimed',
      integrationId: 'int-1',
      event: 'order.paid',
      payload: '{}',
      status: 'PENDING',
      attempts: 0,
      nextRetryAt: null,
      integration: { id: 'int-1', status: 'ACTIVE', webhookUrl: 'https://merchant.example/webhooks', webhookSecret: null, secrets: [] },
    })
    mocks.prisma.outboundWebhookDelivery.updateMany.mockResolvedValue({ count: 0 })

    const result = await processOutboundWebhook('delivery-claimed')

    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('schedules retry on failed delivery and exhausts after max attempts', async () => {
    vi.setSystemTime(new Date('2026-04-28T12:00:00.000Z'))
    vi.useFakeTimers()
    mocks.prisma.outboundWebhookDelivery.findUnique.mockResolvedValue({
      id: 'delivery-2',
      integrationId: 'int-1',
      event: 'order.paid',
      payload: '{}',
      status: 'RETRYING',
      attempts: 4,
      nextRetryAt: null,
      integration: {
        id: 'int-1',
        status: 'ACTIVE',
        webhookUrl: 'https://merchant.example/webhooks',
        webhookSecret: null,
        secrets: [],
      },
    })
    mocks.prisma.outboundWebhookDelivery.update.mockResolvedValue({ id: 'delivery-2', status: 'EXHAUSTED' })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server error',
    })

    await processOutboundWebhook('delivery-2')

    expect(mocks.prisma.outboundWebhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'EXHAUSTED', attempts: 5, statusCode: 500, responseBody: 'server error', lastError: 'HTTP Error 500' }),
      })
    )
  })

  it('processes due deliveries and supports manual retry', async () => {
    mocks.prisma.outboundWebhookDelivery.findMany.mockResolvedValue([{ id: 'delivery-1' }, { id: 'delivery-2' }])
    mocks.prisma.outboundWebhookDelivery.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'delivery-3', status: 'EXHAUSTED' })
      .mockResolvedValueOnce(null)
    mocks.prisma.outboundWebhookDelivery.update.mockResolvedValue({ id: 'delivery-3', status: 'PENDING' })

    const due = await processDueOutboundDeliveries(25)
    await retryOutboundWebhookDelivery('delivery-3')

    expect(mocks.prisma.outboundWebhookDelivery.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }))
    expect(due.processed).toBe(2)
    expect(mocks.prisma.outboundWebhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'delivery-3' },
        data: expect.objectContaining({ status: 'PENDING', nextRetryAt: null, processedAt: null, lastError: null }),
      })
    )
  })

  it('returns null when manual retry targets a missing or successful delivery', async () => {
    mocks.prisma.outboundWebhookDelivery.findUnique.mockResolvedValueOnce(null)
    await expect(retryOutboundWebhookDelivery('missing')).resolves.toBeNull()

    mocks.prisma.outboundWebhookDelivery.findUnique.mockResolvedValueOnce({ id: 'delivery-success', status: 'SUCCESS' })
    await expect(retryOutboundWebhookDelivery('delivery-success')).resolves.toBeNull()
  })
})
