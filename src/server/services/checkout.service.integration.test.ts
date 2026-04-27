import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '@/lib/prisma'

import { completeCheckoutFromPaymentIntent } from './checkout.service'

const runIntegration =
  process.env.DATABASE_URL_TEST && process.env.DATABASE_URL === process.env.DATABASE_URL_TEST
    ? describe
    : describe.skip

const address = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  address1: '1 Compute Way',
  city: 'London',
  postalCode: 'N1 1AA',
  country: 'GB',
}

async function cleanTestData() {
  await prisma.discountApplication.deleteMany()
  await prisma.discount.deleteMany()
  await prisma.refund.deleteMany()
  await prisma.return.deleteMany()
  await prisma.fulfillmentItem.deleteMany()
  await prisma.fulfillment.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.orderEvent.deleteMany()
  await prisma.orderAddress.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.checkoutSession.deleteMany()
  await prisma.customerAddress.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.collectionProduct.deleteMany()
  await prisma.collection.deleteMany()
  await prisma.productMedia.deleteMany()
  await prisma.mediaAsset.deleteMany()
  await prisma.productOptionValue.deleteMany()
  await prisma.productOption.deleteMany()
  await prisma.productVariant.deleteMany()
  await prisma.product.deleteMany()
  await prisma.store.deleteMany()
}

async function seedCheckout({
  paymentIntentId,
  inventory,
  quantity,
  discountCode,
}: {
  paymentIntentId: string
  inventory: number
  quantity: number
  discountCode?: string
}) {
  await prisma.store.create({
    data: {
      name: 'Integration Store',
      email: 'orders@example.com',
      currency: 'USD',
      shippingThreshold: 75,
    },
  })

  const product = await prisma.product.create({
    data: {
      title: 'Integration Shirt',
      handle: `integration-shirt-${paymentIntentId}`,
      status: 'ACTIVE',
      variants: {
        create: {
          title: 'Default',
          sku: `SKU-${paymentIntentId}`,
          price: 25,
          inventory,
        },
      },
    },
    include: {
      variants: true,
    },
  })

  const variant = product.variants[0]
  const subtotal = 25 * quantity
  const shippingAmount = subtotal >= 75 ? 0 : 9.99
  const discount = discountCode
    ? await prisma.discount.create({
        data: {
          code: discountCode,
          title: 'Launch 10',
          type: 'CODE',
          method: 'PERCENTAGE',
          value: 10,
          status: 'ACTIVE',
        },
      })
    : null
  const discountAmount = discount ? Number((subtotal * 0.1).toFixed(2)) : 0
  const total = Number((subtotal + shippingAmount - discountAmount).toFixed(2))

  await prisma.checkoutSession.create({
    data: {
      paymentIntentId,
      email: 'ada@example.com',
      currency: 'USD',
      subtotal,
      shippingAmount,
      taxAmount: 0,
      discountAmount,
      total,
      payload: {
        email: 'ada@example.com',
        shippingAddress: address,
        billingAddress: address,
        items: [
          {
            productId: product.id,
            variantId: variant.id,
            title: product.title,
            variantTitle: variant.title,
            sku: variant.sku,
            price: variant.price,
            quantity,
          },
        ],
        ...(discount
          ? {
              discountApplications: [
                {
                  discountId: discount.id,
                  code: discount.code,
                  title: discount.title,
                  method: discount.method,
                  amount: discountAmount,
                },
              ],
            }
          : {}),
      },
    },
  })

  return {
    product,
    variant,
    discount,
    discountAmount,
    total,
  }
}

runIntegration('checkout service integration', () => {
  beforeEach(async () => {
    await cleanTestData()
  }, 60_000)

  afterAll(async () => {
    await cleanTestData()
    await prisma.$disconnect()
  }, 60_000)

  it('creates a paid order and decrements inventory after verified payment success', async () => {
    const { variant } = await seedCheckout({
      paymentIntentId: 'pi_integration_success',
      inventory: 5,
      quantity: 2,
    })

    const order = await completeCheckoutFromPaymentIntent({
      id: 'pi_integration_success',
      amount: 5999,
      currency: 'usd',
      status: 'succeeded',
      latest_charge: 'ch_integration_success',
    })

    const updatedVariant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
    })
    const checkoutSession = await prisma.checkoutSession.findUniqueOrThrow({
      where: { paymentIntentId: 'pi_integration_success' },
    })

    expect(order.paymentStatus).toBe('PAID')
    expect(order.items).toHaveLength(1)
    expect(order.payments).toHaveLength(1)
    expect(updatedVariant.inventory).toBe(3)
    expect(checkoutSession.status).toBe('COMPLETED')
    expect(checkoutSession.completedAt).toBeInstanceOf(Date)
  })

  it('handles duplicate payment-intent completion without duplicating orders or inventory decrements', async () => {
    const { variant } = await seedCheckout({
      paymentIntentId: 'pi_integration_duplicate',
      inventory: 5,
      quantity: 2,
    })

    const firstOrder = await completeCheckoutFromPaymentIntent({
      id: 'pi_integration_duplicate',
      amount: 5999,
      currency: 'usd',
      status: 'succeeded',
    })
    const secondOrder = await completeCheckoutFromPaymentIntent({
      id: 'pi_integration_duplicate',
      amount: 5999,
      currency: 'usd',
      status: 'succeeded',
    })

    const updatedVariant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
    })
    const orderCount = await prisma.order.count()
    const paymentCount = await prisma.payment.count({
      where: { stripePaymentIntentId: 'pi_integration_duplicate' },
    })

    expect(secondOrder.id).toBe(firstOrder.id)
    expect(orderCount).toBe(1)
    expect(paymentCount).toBe(1)
    expect(updatedVariant.inventory).toBe(3)
  })

  it('keeps inventory idempotent during competing duplicate payment-intent completions', async () => {
    const { variant } = await seedCheckout({
      paymentIntentId: 'pi_integration_race',
      inventory: 3,
      quantity: 2,
    })

    const results = await Promise.all([
      completeCheckoutFromPaymentIntent({
        id: 'pi_integration_race',
        amount: 5999,
        currency: 'usd',
        status: 'succeeded',
      }),
      completeCheckoutFromPaymentIntent({
        id: 'pi_integration_race',
        amount: 5999,
        currency: 'usd',
        status: 'succeeded',
      }),
    ])

    const updatedVariant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
    })
    const orderCount = await prisma.order.count()
    const paymentCount = await prisma.payment.count({
      where: { stripePaymentIntentId: 'pi_integration_race' },
    })

    expect(results[1].id).toBe(results[0].id)
    expect(orderCount).toBe(1)
    expect(paymentCount).toBe(1)
    expect(updatedVariant.inventory).toBe(1)
  })

  it('fails paid order creation when inventory is exhausted and leaves state consistent', async () => {
    const { variant } = await seedCheckout({
      paymentIntentId: 'pi_integration_exhausted',
      inventory: 1,
      quantity: 2,
    })

    await expect(
      completeCheckoutFromPaymentIntent({
        id: 'pi_integration_exhausted',
        amount: 5999,
        currency: 'usd',
        status: 'succeeded',
      })
    ).rejects.toThrow(`Insufficient inventory for variant ${variant.id}`)

    const updatedVariant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
    })
    const checkoutSession = await prisma.checkoutSession.findUniqueOrThrow({
      where: { paymentIntentId: 'pi_integration_exhausted' },
    })
    const orderCount = await prisma.order.count()
    const paymentCount = await prisma.payment.count()

    expect(updatedVariant.inventory).toBe(1)
    expect(checkoutSession.status).toBe('PENDING')
    expect(orderCount).toBe(0)
    expect(paymentCount).toBe(0)
  })

  it('creates discount applications and usage only after verified payment success', async () => {
    const { discount } = await seedCheckout({
      paymentIntentId: 'pi_integration_discount',
      inventory: 5,
      quantity: 2,
      discountCode: 'LAUNCH10',
    })

    expect(discount).not.toBeNull()
    expect(await prisma.discountApplication.count()).toBe(0)
    await expect(
      prisma.discount.findUniqueOrThrow({
        where: { id: discount!.id },
      })
    ).resolves.toMatchObject({ usageCount: 0 })

    const firstOrder = await completeCheckoutFromPaymentIntent({
      id: 'pi_integration_discount',
      amount: 5499,
      currency: 'usd',
      status: 'succeeded',
    })
    const secondOrder = await completeCheckoutFromPaymentIntent({
      id: 'pi_integration_discount',
      amount: 5499,
      currency: 'usd',
      status: 'succeeded',
    })

    const paidOrder = await prisma.order.findUniqueOrThrow({
      where: { id: firstOrder.id },
      include: { discountApplications: true },
    })
    const updatedDiscount = await prisma.discount.findUniqueOrThrow({
      where: { id: discount!.id },
    })

    expect(secondOrder.id).toBe(firstOrder.id)
    expect(paidOrder.discountAmount).toBe(5)
    expect(paidOrder.total).toBe(54.99)
    expect(paidOrder.discountApplications).toEqual([
      expect.objectContaining({
        discountId: discount!.id,
        amount: 5,
      }),
    ])
    expect(await prisma.order.count()).toBe(1)
    expect(await prisma.discountApplication.count()).toBe(1)
    expect(updatedDiscount.usageCount).toBe(1)
  })
})
