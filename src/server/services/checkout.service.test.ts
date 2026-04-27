import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    productVariant: {
      findMany: vi.fn(),
    },
    checkoutSession: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    discount: {
      findUnique: vi.fn(),
    },
  },
  createStripePaymentIntent: vi.fn(),
  getStoreSettings: vi.fn(),
  getCustomerByEmail: vi.fn(),
  createCustomer: vi.fn(),
  addCustomerAddress: vi.fn(),
  createOrder: vi.fn(),
  getOrderByPaymentIntentId: vi.fn(),
  emitInternalEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/lib/stripe', () => ({
  createStripePaymentIntent: mocks.createStripePaymentIntent,
}))

vi.mock('@/server/services/settings.service', () => ({
  getStoreSettings: mocks.getStoreSettings,
}))

vi.mock('@/server/services/customer.service', () => ({
  getCustomerByEmail: mocks.getCustomerByEmail,
  createCustomer: mocks.createCustomer,
  addCustomerAddress: mocks.addCustomerAddress,
}))

vi.mock('@/server/services/order.service', () => ({
  createOrder: mocks.createOrder,
  getOrderByPaymentIntentId: mocks.getOrderByPaymentIntentId,
}))

vi.mock('@/server/events/dispatcher', () => ({
  emitInternalEvent: mocks.emitInternalEvent,
}))

import {
  completeCheckoutFromPaymentIntent,
  createCheckoutPaymentIntent,
} from './checkout.service'

const address = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  address1: '1 Compute Way',
  city: 'London',
  postalCode: 'N1 1AA',
  country: 'GB',
}

describe('checkout service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStoreSettings.mockResolvedValue({
      currency: 'USD',
      shippingThreshold: 75,
    })
    mocks.getCustomerByEmail.mockResolvedValue(null)
  })

  it('creates a Stripe payment intent from server-owned live pricing', async () => {
    mocks.prisma.productVariant.findMany.mockResolvedValue([
      {
        id: 'variant_1',
        productId: 'product_1',
        title: 'Default',
        sku: 'SKU-1',
        price: 25,
        inventory: 3,
        product: {
          id: 'product_1',
          title: 'Test Shirt',
        },
      },
    ])
    mocks.createStripePaymentIntent.mockResolvedValue({
      id: 'pi_test',
      client_secret: 'secret_test',
      amount: 5999,
      currency: 'usd',
      status: 'requires_payment_method',
    })
    mocks.prisma.checkoutSession.create.mockResolvedValue({
      id: 'checkout_1',
    })

    const checkout = await createCheckoutPaymentIntent({
      email: ' ADA@EXAMPLE.COM ',
      items: [{ variantId: 'variant_1', quantity: 2 }],
      shippingAddress: address,
    })

    expect(mocks.createStripePaymentIntent).toHaveBeenCalledWith({
      amount: 5999,
      currency: 'USD',
      email: 'ada@example.com',
      metadata: {
        checkoutEmail: 'ada@example.com',
      },
    })
    expect(mocks.prisma.checkoutSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentIntentId: 'pi_test',
        email: 'ada@example.com',
        currency: 'USD',
        subtotal: 50,
        shippingAmount: 9.99,
        taxAmount: 0,
        discountAmount: 0,
        total: 59.99,
      }),
    })
    expect(checkout).toMatchObject({
      checkoutSessionId: 'checkout_1',
      paymentIntentId: 'pi_test',
      clientSecret: 'secret_test',
      subtotal: 50,
      shippingAmount: 9.99,
      total: 59.99,
      items: [
        expect.objectContaining({
          productId: 'product_1',
          variantId: 'variant_1',
          price: 25,
          quantity: 2,
        }),
      ],
    })
  })

  it('uses destination shipping zone and tax rules for checkout totals', async () => {
    mocks.getStoreSettings.mockResolvedValue({
      currency: 'USD',
      shippingThreshold: 1000,
      country: 'US',
    })
    mocks.prisma.productVariant.findMany.mockResolvedValue([
      {
        id: 'variant_1',
        productId: 'product_1',
        title: 'Default',
        sku: 'SKU-1',
        price: 20,
        inventory: 3,
        product: {
          id: 'product_1',
          title: 'Test Shirt',
        },
      },
    ])
    mocks.createStripePaymentIntent.mockResolvedValue({
      id: 'pi_zone_tax',
      client_secret: 'secret_zone_tax',
      amount: 4099,
      currency: 'usd',
      status: 'requires_payment_method',
    })
    mocks.prisma.checkoutSession.create.mockResolvedValue({
      id: 'checkout_zone_tax',
    })

    const checkout = await createCheckoutPaymentIntent({
      email: 'ada@example.com',
      items: [{ variantId: 'variant_1', quantity: 1 }],
      shippingAddress: {
        ...address,
        country: 'CA',
        province: 'ON',
      },
    })

    expect(mocks.createStripePaymentIntent).toHaveBeenCalledWith({
      amount: 4099,
      currency: 'USD',
      email: 'ada@example.com',
      metadata: {
        checkoutEmail: 'ada@example.com',
      },
    })
    expect(checkout).toMatchObject({
      checkoutSessionId: 'checkout_zone_tax',
      subtotal: 20,
      shippingAmount: 19.99,
      taxAmount: 1,
      total: 40.99,
    })
  })

  it('applies an active discount code through server-owned pricing', async () => {
    mocks.prisma.productVariant.findMany.mockResolvedValue([
      {
        id: 'variant_1',
        productId: 'product_1',
        title: 'Default',
        sku: 'SKU-1',
        price: 25,
        inventory: 3,
        product: {
          id: 'product_1',
          title: 'Test Shirt',
        },
      },
    ])
    mocks.prisma.discount.findUnique.mockResolvedValue({
      id: 'discount_1',
      code: 'LAUNCH10',
      title: 'Launch 10',
      type: 'CODE',
      method: 'PERCENTAGE',
      value: 10,
      minimumOrder: null,
      usageLimit: null,
      usageCount: 0,
      status: 'ACTIVE',
      startsAt: null,
      endsAt: null,
    })
    mocks.createStripePaymentIntent.mockResolvedValue({
      id: 'pi_discount',
      client_secret: 'secret_discount',
      amount: 5499,
      currency: 'usd',
      status: 'requires_payment_method',
    })
    mocks.prisma.checkoutSession.create.mockResolvedValue({
      id: 'checkout_discount',
    })

    const checkout = await createCheckoutPaymentIntent({
      email: 'ada@example.com',
      items: [{ variantId: 'variant_1', quantity: 2 }],
      shippingAddress: address,
      discountCode: ' launch10 ',
    })

    expect(mocks.prisma.discount.findUnique).toHaveBeenCalledWith({
      where: { code: 'LAUNCH10' },
    })
    expect(mocks.createStripePaymentIntent).toHaveBeenCalledWith({
      amount: 5499,
      currency: 'USD',
      email: 'ada@example.com',
      metadata: {
        checkoutEmail: 'ada@example.com',
      },
    })
    expect(mocks.prisma.checkoutSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentIntentId: 'pi_discount',
        subtotal: 50,
        shippingAmount: 9.99,
        taxAmount: 0,
        discountAmount: 5,
        total: 54.99,
        payload: expect.objectContaining({
          discountApplications: [
            {
              discountId: 'discount_1',
              code: 'LAUNCH10',
              title: 'Launch 10',
              method: 'PERCENTAGE',
              amount: 5,
            },
          ],
        }),
      }),
    })
    expect(checkout).toMatchObject({
      checkoutSessionId: 'checkout_discount',
      subtotal: 50,
      shippingAmount: 9.99,
      discountAmount: 5,
      total: 54.99,
      appliedDiscount: {
        discountId: 'discount_1',
        code: 'LAUNCH10',
        amount: 5,
      },
    })
  })

  it('rejects missing discount codes before creating a Stripe payment intent', async () => {
    mocks.prisma.productVariant.findMany.mockResolvedValue([
      {
        id: 'variant_1',
        productId: 'product_1',
        title: 'Default',
        sku: 'SKU-1',
        price: 25,
        inventory: 3,
        product: {
          id: 'product_1',
          title: 'Test Shirt',
        },
      },
    ])
    mocks.prisma.discount.findUnique.mockResolvedValue(null)

    await expect(
      createCheckoutPaymentIntent({
        email: 'ada@example.com',
        items: [{ variantId: 'variant_1', quantity: 2 }],
        shippingAddress: address,
        discountCode: 'missing',
      })
    ).rejects.toThrow('Discount code not found')

    expect(mocks.createStripePaymentIntent).not.toHaveBeenCalled()
    expect(mocks.prisma.checkoutSession.create).not.toHaveBeenCalled()
  })

  it('returns the existing paid order for duplicate payment-intent completion', async () => {
    const existingOrder = {
      id: 'order_1',
      orderNumber: 1001,
    }
    mocks.getOrderByPaymentIntentId.mockResolvedValue(existingOrder)

    const order = await completeCheckoutFromPaymentIntent({
      id: 'pi_duplicate',
      amount: 5999,
      currency: 'usd',
      status: 'succeeded',
    })

    expect(order).toBe(existingOrder)
    expect(mocks.prisma.checkoutSession.updateMany).toHaveBeenCalledWith({
      where: { paymentIntentId: 'pi_duplicate' },
      data: { status: 'COMPLETED', completedAt: expect.any(Date) },
    })
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it('fails checkout creation when requested quantity exceeds live inventory', async () => {
    mocks.prisma.productVariant.findMany.mockResolvedValue([
      {
        id: 'variant_1',
        productId: 'product_1',
        title: 'Default',
        sku: 'SKU-1',
        price: 25,
        inventory: 1,
        product: {
          id: 'product_1',
          title: 'Test Shirt',
        },
      },
    ])

    await expect(
      createCheckoutPaymentIntent({
        email: 'ada@example.com',
        items: [{ variantId: 'variant_1', quantity: 2 }],
        shippingAddress: address,
      })
    ).rejects.toThrow('Only 1 units left for Test Shirt')

    expect(mocks.createStripePaymentIntent).not.toHaveBeenCalled()
    expect(mocks.prisma.checkoutSession.create).not.toHaveBeenCalled()
  })
})
