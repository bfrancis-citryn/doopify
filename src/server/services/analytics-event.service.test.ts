import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  analyticsEventCreate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    analyticsEvent: {
      create: mocks.analyticsEventCreate,
    },
  },
}))

import { isAnalyticsEventName, recordAnalyticsEvent } from './analytics-event.service'

describe('analytics-event.service', () => {
  beforeEach(() => {
    mocks.analyticsEventCreate.mockReset()
    mocks.analyticsEventCreate.mockResolvedValue({ id: 'ae_1' })
  })

  it('persists analytics events with order/refund references', async () => {
    await recordAnalyticsEvent('refund.issued', {
      orderId: 'ord_1',
      orderNumber: 1001,
      refundId: 'ref_1',
      amount: 25,
      currency: 'USD',
    })

    expect(mocks.analyticsEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'refund.issued',
          orderId: 'ord_1',
          refundId: 'ref_1',
          returnId: undefined,
          deliveryId: undefined,
        }),
      })
    )
  })

  it('persists email analytics with delivery and order references', async () => {
    await recordAnalyticsEvent('email.sent', {
      deliveryId: 'del_1',
      event: 'order.paid',
      template: 'order_confirmation',
      recipientEmail: 'owner@example.com',
      provider: 'resend',
      providerMessageId: 'msg_1',
      orderId: 'ord_1',
    })

    expect(mocks.analyticsEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'email.sent',
          orderId: 'ord_1',
          deliveryId: 'del_1',
        }),
      })
    )
  })

  it('recognizes analytics lifecycle event names', () => {
    expect(isAnalyticsEventName('order.paid')).toBe(true)
    expect(isAnalyticsEventName('product.updated')).toBe(false)
  })
})
