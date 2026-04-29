import { beforeEach, describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'

const mocks = vi.hoisted(() => ({
  env: {
    EASYPOST_WEBHOOK_SECRET: 'ep_whsec',
    SHIPPO_WEBHOOK_SECRET: 'shippo_whsec',
  },
  prisma: {
    shippingLabel: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    fulfillment: {
      update: vi.fn(),
    },
    orderEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  queueShippingTrackingSyncJob: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  env: mocks.env,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/server/shipping/shipping-tracking-jobs.service', () => ({
  queueShippingTrackingSyncJob: mocks.queueShippingTrackingSyncJob,
}))

import {
  applyShippingProviderTrackingWebhookEvent,
  parseShippingProviderWebhookPayload,
  verifyShippingProviderWebhookSignature,
} from './shipping-tracking-webhook.service'

describe('shipping tracking webhook service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mocks.prisma) => Promise<unknown>) => fn(mocks.prisma)
    )
    mocks.prisma.shippingLabel.update.mockResolvedValue({})
    mocks.prisma.fulfillment.update.mockResolvedValue({})
    mocks.prisma.orderEvent.create.mockResolvedValue({})
    mocks.queueShippingTrackingSyncJob.mockResolvedValue({ id: 'job_1' })
    mocks.env.EASYPOST_WEBHOOK_SECRET = 'ep_whsec'
    mocks.env.SHIPPO_WEBHOOK_SECRET = 'shippo_whsec'
  })

  it('parses shippo webhook payload into normalized tracking event', () => {
    const parsed = parseShippingProviderWebhookPayload({
      provider: 'SHIPPO',
      payload: JSON.stringify({
        event: 'track_updated',
        event_id: 'evt_shippo_1',
        data: {
          tracking_number: 'TRACK123',
          tracking_url_provider: 'https://track.example.com/TRACK123',
          tracking_status: {
            status: 'DELIVERED',
            status_date: '2026-04-29T20:00:00.000Z',
          },
          shipment: 'shp_1',
          transaction: 'txn_1',
        },
      }),
    })

    expect(parsed).toEqual(
      expect.objectContaining({
        provider: 'SHIPPO',
        providerEventId: 'evt_shippo_1',
        lifecycleStatus: 'DELIVERED',
        trackingNumber: 'TRACK123',
      })
    )
  })

  it('returns missing tracking reference when payload cannot be mapped', async () => {
    const result = await applyShippingProviderTrackingWebhookEvent({
      provider: 'EASYPOST',
      eventType: 'tracker.updated',
      providerStatus: 'IN_TRANSIT',
      lifecycleStatus: 'IN_TRANSIT',
    })

    expect(result).toEqual({ handled: false, reason: 'MISSING_TRACKING_REFERENCE' })
  })

  it('marks fulfillment delivered when webhook reports delivered', async () => {
    mocks.prisma.shippingLabel.findFirst.mockResolvedValue({
      id: 'label_1',
      provider: 'EASYPOST',
      orderId: 'order_1',
      fulfillmentId: 'ful_1',
      trackingNumber: 'TRACK123',
      trackingUrl: null,
      fulfillment: {
        id: 'ful_1',
        status: 'OPEN',
        orderId: 'order_1',
        deliveredAt: null,
        trackingNumber: 'TRACK123',
        trackingUrl: null,
      },
    })

    const result = await applyShippingProviderTrackingWebhookEvent({
      provider: 'EASYPOST',
      providerEventId: 'evt_1',
      eventType: 'tracker.updated',
      providerStatus: 'DELIVERED',
      lifecycleStatus: 'DELIVERED',
      trackingNumber: 'TRACK123',
      trackingUrl: 'https://track.example.com/TRACK123',
      deliveredAt: '2026-04-29T22:00:00.000Z',
    })

    expect(result).toEqual({ handled: true })
    expect(mocks.prisma.fulfillment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ful_1' },
        data: expect.objectContaining({
          status: 'SUCCESS',
          deliveredAt: new Date('2026-04-29T22:00:00.000Z'),
          trackingUrl: 'https://track.example.com/TRACK123',
        }),
      })
    )
    expect(mocks.prisma.orderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order_1',
          type: 'SHIPPING_DELIVERED',
        }),
      })
    )
    expect(mocks.queueShippingTrackingSyncJob).toHaveBeenCalledWith({
      fulfillmentId: 'ful_1',
      orderId: 'order_1',
    })
  })

  it('verifies easypost signatures using hmac digest', () => {
    const payload = JSON.stringify({ test: true })
    const signature = crypto
      .createHmac('sha256', 'ep_whsec')
      .update(payload, 'utf8')
      .digest('hex')

    expect(() =>
      verifyShippingProviderWebhookSignature({
        provider: 'EASYPOST',
        payload,
        headers: new Headers({
          'x-hmac-signature': signature,
        }),
      })
    ).not.toThrow()
  })
})
