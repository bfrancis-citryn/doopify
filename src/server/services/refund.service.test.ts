import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORDER_ID = 'order-1'
const PAYMENT_ID = 'pay-1'
const REFUND_ID = 'ref-1'
const STRIPE_REFUND_ID = 're_stripe_1'
const VARIANT_ID = 'var-1'
const ORDER_ITEM_ID = 'oi-1'

const mocks = vi.hoisted(() => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refund: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    productVariant: {
      update: vi.fn(),
    },
    orderEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  createStripeRefund: vi.fn(),
  emitInternalEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/stripe', () => ({ createStripeRefund: mocks.createStripeRefund }))
vi.mock('@/server/events/dispatcher', () => ({ emitInternalEvent: mocks.emitInternalEvent }))

import { getOrderRefunds, getRefund, issueRefund } from './refund.service'

const baseOrder = { id: ORDER_ID, orderNumber: 1001, currency: 'USD', paymentStatus: 'PAID' }
const basePayment = {
  id: PAYMENT_ID,
  amount: 100,
  stripePaymentIntentId: 'pi_test',
  stripeChargeId: 'ch_test',
  refunds: [],
}
const baseRefund = {
  id: REFUND_ID,
  orderId: ORDER_ID,
  paymentId: PAYMENT_ID,
  stripeRefundId: STRIPE_REFUND_ID,
  status: 'ISSUED',
  amount: 50,
  reason: 'requested_by_customer',
  restockItems: false,
  items: [],
}

function setupTx() {
  mocks.prisma.$transaction.mockImplementation(async (fn: (tx: typeof mocks.prisma) => Promise<unknown>) => fn(mocks.prisma))
}

beforeEach(() => {
  vi.clearAllMocks()
  setupTx()
})

describe('issueRefund', () => {
  it('creates a Stripe refund and persists a Refund record', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(baseOrder)
    mocks.prisma.payment.findUnique.mockResolvedValue(basePayment)
    mocks.createStripeRefund.mockResolvedValue({ id: STRIPE_REFUND_ID })
    mocks.prisma.refund.create.mockResolvedValue(baseRefund)
    mocks.prisma.payment.update.mockResolvedValue({})
    mocks.prisma.order.update.mockResolvedValue({})
    mocks.prisma.orderEvent.create.mockResolvedValue({})
    mocks.emitInternalEvent.mockResolvedValue(undefined)

    const result = await issueRefund({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      amount: 50,
      reason: 'requested_by_customer',
    })

    expect(mocks.createStripeRefund).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000 }) // 50 * 100 cents
    )
    expect(mocks.prisma.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ISSUED',
          stripeRefundId: STRIPE_REFUND_ID,
          amount: 50,
        }),
      })
    )
    expect(mocks.prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'PARTIALLY_REFUNDED' },
      })
    )
    expect(mocks.emitInternalEvent).toHaveBeenCalledWith('order.refunded', expect.objectContaining({
      refundId: REFUND_ID,
      amount: 50,
    }))
    expect(result.id).toBe(REFUND_ID)
  })

  it('marks payment as REFUNDED when full amount is refunded', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(baseOrder)
    mocks.prisma.payment.findUnique.mockResolvedValue({ ...basePayment, amount: 50 })
    mocks.createStripeRefund.mockResolvedValue({ id: STRIPE_REFUND_ID })
    mocks.prisma.refund.create.mockResolvedValue({ ...baseRefund, amount: 50 })
    mocks.prisma.payment.update.mockResolvedValue({})
    mocks.prisma.order.update.mockResolvedValue({})
    mocks.prisma.orderEvent.create.mockResolvedValue({})
    mocks.emitInternalEvent.mockResolvedValue(undefined)

    await issueRefund({ orderId: ORDER_ID, paymentId: PAYMENT_ID, amount: 50 })

    expect(mocks.prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REFUNDED' } })
    )
  })

  it('restocks inventory when restockItems is true', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(baseOrder)
    mocks.prisma.payment.findUnique.mockResolvedValue(basePayment)
    mocks.createStripeRefund.mockResolvedValue({ id: STRIPE_REFUND_ID })
    mocks.prisma.refund.create.mockResolvedValue({ ...baseRefund, restockItems: true, items: [{ id: 'ri-1', refundId: REFUND_ID, orderItemId: ORDER_ITEM_ID, variantId: VARIANT_ID, quantity: 1, amount: 50 }] })
    mocks.prisma.payment.update.mockResolvedValue({})
    mocks.prisma.order.update.mockResolvedValue({})
    mocks.prisma.orderEvent.create.mockResolvedValue({})
    mocks.prisma.productVariant.update.mockResolvedValue({})
    mocks.emitInternalEvent.mockResolvedValue(undefined)

    await issueRefund({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      amount: 50,
      restockItems: true,
      items: [{ orderItemId: ORDER_ITEM_ID, variantId: VARIANT_ID, quantity: 1, amount: 50 }],
    })

    expect(mocks.prisma.productVariant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VARIANT_ID },
        data: { inventory: { increment: 1 } },
      })
    )
  })

  it('throws when refund amount exceeds refundable amount', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(baseOrder)
    mocks.prisma.payment.findUnique.mockResolvedValue({
      ...basePayment,
      amount: 100,
      refunds: [{ amount: 80, status: 'ISSUED' }],
    })

    await expect(
      issueRefund({ orderId: ORDER_ID, paymentId: PAYMENT_ID, amount: 30 })
    ).rejects.toThrow('exceeds refundable amount')
  })

  it('throws when order is not found', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(null)
    mocks.prisma.payment.findUnique.mockResolvedValue(basePayment)

    await expect(
      issueRefund({ orderId: 'missing', paymentId: PAYMENT_ID, amount: 10 })
    ).rejects.toThrow('Order not found')
  })
})

describe('getOrderRefunds', () => {
  it('returns all refunds for an order', async () => {
    mocks.prisma.refund.findMany.mockResolvedValue([baseRefund])
    const result = await getOrderRefunds(ORDER_ID)
    expect(result).toHaveLength(1)
    expect(mocks.prisma.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderId: ORDER_ID } })
    )
  })
})

describe('getRefund', () => {
  it('returns a single refund by id', async () => {
    mocks.prisma.refund.findUnique.mockResolvedValue(baseRefund)
    const result = await getRefund(REFUND_ID)
    expect(result?.id).toBe(REFUND_ID)
  })
})
