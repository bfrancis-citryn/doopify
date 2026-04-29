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
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    return: {
      update: vi.fn(),
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

const baseOrder = {
  id: ORDER_ID,
  orderNumber: 1001,
  currency: 'USD',
  paymentStatus: 'PAID',
  items: [{ id: ORDER_ITEM_ID, variantId: VARIANT_ID, quantity: 2, priceCents: 5000, totalCents: 10000 }],
  refunds: [],
}
const basePayment = {
  id: PAYMENT_ID,
  orderId: ORDER_ID,
  amountCents: 10000,
  stripePaymentIntentId: 'pi_test',
  stripeChargeId: 'ch_test',
  refunds: [],
}
const pendingRefund = {
  id: REFUND_ID,
  orderId: ORDER_ID,
  paymentId: PAYMENT_ID,
  stripeRefundId: null,
  status: 'PENDING',
  amountCents: 5000,
  reason: 'requested_by_customer',
  restockItems: false,
  items: [],
}
const issuedRefund = {
  ...pendingRefund,
  stripeRefundId: STRIPE_REFUND_ID,
  status: 'ISSUED',
}

function setupTx() {
  mocks.prisma.$transaction.mockImplementation(async (fn: (tx: typeof mocks.prisma) => Promise<unknown>) => fn(mocks.prisma))
}

function setupSuccess(overrides: { order?: unknown; payment?: unknown; refund?: unknown } = {}) {
  mocks.prisma.order.findUnique.mockResolvedValue(overrides.order ?? baseOrder)
  mocks.prisma.payment.findUnique.mockResolvedValue(overrides.payment ?? basePayment)
  mocks.prisma.refund.create.mockResolvedValue(overrides.refund ?? pendingRefund)
  mocks.createStripeRefund.mockResolvedValue({ id: STRIPE_REFUND_ID })
  mocks.prisma.refund.update.mockResolvedValue(issuedRefund)
  mocks.prisma.payment.update.mockResolvedValue({})
  mocks.prisma.order.update.mockResolvedValue({})
  mocks.prisma.orderEvent.create.mockResolvedValue({})
  mocks.prisma.productVariant.update.mockResolvedValue({})
  mocks.prisma.return.update.mockResolvedValue({})
  mocks.emitInternalEvent.mockResolvedValue(undefined)
}

beforeEach(() => {
  vi.clearAllMocks()
  setupTx()
})

describe('issueRefund', () => {
  it('creates a pending refund, calls Stripe idempotently, and marks it issued', async () => {
    setupSuccess()

    const result = await issueRefund({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      amountCents: 5000,
      reason: 'requested_by_customer',
    })

    expect(mocks.prisma.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          amountCents: 5000,
        }),
      })
    )
    expect(mocks.createStripeRefund).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000, idempotencyKey: `refund:${REFUND_ID}` })
    )
    expect(mocks.prisma.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REFUND_ID },
        data: expect.objectContaining({ status: 'ISSUED', stripeRefundId: STRIPE_REFUND_ID }),
      })
    )
    expect(mocks.prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PARTIALLY_REFUNDED' } })
    )
    expect(mocks.emitInternalEvent).toHaveBeenCalledWith('order.refunded', expect.objectContaining({
      refundId: REFUND_ID,
      amount: 50,
    }))
    expect(result.id).toBe(REFUND_ID)
  })

  it('marks payment as REFUNDED when full amount is refunded', async () => {
    setupSuccess({ payment: { ...basePayment, amountCents: 5000 } })

    await issueRefund({ orderId: ORDER_ID, paymentId: PAYMENT_ID, amountCents: 5000 })

    expect(mocks.prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REFUNDED' } })
    )
  })

  it('restocks validated inventory when restockItems is true', async () => {
    setupSuccess({
      refund: { ...pendingRefund, restockItems: true, items: [{ id: 'ri-1', refundId: REFUND_ID, orderItemId: ORDER_ITEM_ID, variantId: VARIANT_ID, quantity: 1, amountCents: 5000 }] },
    })
    mocks.prisma.refund.update.mockResolvedValue({ ...issuedRefund, restockItems: true })

    await issueRefund({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      amountCents: 5000,
      restockItems: true,
      items: [{ orderItemId: ORDER_ITEM_ID, variantId: VARIANT_ID, quantity: 1, amountCents: 5000 }],
    })

    expect(mocks.prisma.productVariant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VARIANT_ID },
        data: { inventory: { increment: 1 } },
      })
    )
  })

  it('links a refund to a return when returnId is provided', async () => {
    setupSuccess()

    await issueRefund({ orderId: ORDER_ID, paymentId: PAYMENT_ID, amountCents: 5000, returnId: 'ret-1' })

    expect(mocks.prisma.return.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ret-1' }, data: { refundId: REFUND_ID } })
    )
  })

  it('marks pending refund failed when Stripe fails before issuing', async () => {
    setupSuccess()
    mocks.createStripeRefund.mockRejectedValue(new Error('Stripe unavailable'))

    await expect(
      issueRefund({ orderId: ORDER_ID, paymentId: PAYMENT_ID, amountCents: 5000 })
    ).rejects.toThrow('Stripe refund failed before issuing')

    expect(mocks.prisma.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: REFUND_ID }, data: expect.objectContaining({ status: 'FAILED' }) })
    )
  })

  it('throws when refund amount exceeds refundable amount', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(baseOrder)
    mocks.prisma.payment.findUnique.mockResolvedValue({
      ...basePayment,
      amountCents: 10000,
      refunds: [{ amountCents: 8000, status: 'ISSUED' }],
    })

    await expect(
      issueRefund({ orderId: ORDER_ID, paymentId: PAYMENT_ID, amountCents: 3000 })
    ).rejects.toThrow('exceeds refundable amount')
  })

  it('throws when refund item does not belong to the order', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(baseOrder)
    mocks.prisma.payment.findUnique.mockResolvedValue(basePayment)

    await expect(
      issueRefund({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        amountCents: 1000,
        restockItems: true,
        items: [{ orderItemId: 'wrong-item', quantity: 1, amountCents: 1000 }],
      })
    ).rejects.toThrow('Refund item does not belong to this order')
  })

  it('throws when order is not found', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(null)
    mocks.prisma.payment.findUnique.mockResolvedValue(basePayment)

    await expect(
      issueRefund({ orderId: 'missing', paymentId: PAYMENT_ID, amountCents: 1000 })
    ).rejects.toThrow('Order not found')
  })
})

describe('getOrderRefunds', () => {
  it('returns all refunds for an order', async () => {
    mocks.prisma.refund.findMany.mockResolvedValue([issuedRefund])
    const result = await getOrderRefunds(ORDER_ID)
    expect(result).toHaveLength(1)
    expect(mocks.prisma.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderId: ORDER_ID } })
    )
  })
})

describe('getRefund', () => {
  it('returns a single refund by id', async () => {
    mocks.prisma.refund.findUnique.mockResolvedValue(issuedRefund)
    const result = await getRefund(REFUND_ID)
    expect(result?.id).toBe(REFUND_ID)
  })
})
