import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '@/lib/prisma'
import {
  applyEmailProviderWebhookEvent,
  resendEmailDelivery,
} from './email-delivery.service'

const runIntegration =
  process.env.DATABASE_URL_TEST && process.env.DATABASE_URL === process.env.DATABASE_URL_TEST
    ? describe
    : describe.skip

const originalResendApiKey = process.env.RESEND_API_KEY

async function cleanTestData() {
  await prisma.emailDelivery.deleteMany()
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
  await prisma.customerAddress.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.productOptionValue.deleteMany()
  await prisma.productOption.deleteMany()
  await prisma.productVariant.deleteMany()
  await prisma.product.deleteMany()
  await prisma.store.deleteMany()
}

async function seedOrderForEmail(orderKey: string, recipientEmail: string) {
  const product = await prisma.product.create({
    data: {
      title: `Email Product ${orderKey}`,
      handle: `email-product-${orderKey}`,
      status: 'ACTIVE',
      variants: {
        create: {
          title: 'Default',
          sku: `EMAIL-${orderKey}`,
          price: 25,
          inventory: 100,
        },
      },
    },
    include: {
      variants: true,
    },
  })

  return prisma.order.create({
    data: {
      email: recipientEmail,
      paymentStatus: 'PAID',
      subtotal: 50,
      shippingAmount: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 50,
      currency: 'USD',
      items: {
        create: {
          productId: product.id,
          variantId: product.variants[0].id,
          title: product.title,
          variantTitle: product.variants[0].title,
          sku: product.variants[0].sku,
          price: 25,
          quantity: 2,
          total: 50,
        },
      },
      addresses: {
        create: {
          type: 'SHIPPING',
          firstName: 'Ada',
          lastName: 'Lovelace',
          address1: '1 Compute Way',
          city: 'London',
          postalCode: 'N1 1AA',
          country: 'GB',
        },
      },
    },
  })
}

runIntegration('email delivery integration', () => {
  beforeEach(async () => {
    process.env.RESEND_API_KEY = ''
    await cleanTestData()
  }, 60_000)

  afterAll(async () => {
    await cleanTestData()
    if (originalResendApiKey == null) {
      delete process.env.RESEND_API_KEY
    } else {
      process.env.RESEND_API_KEY = originalResendApiKey
    }
    await prisma.$disconnect()
  }, 60_000)

  it('resends failed order-confirmation deliveries as a new tracked delivery without duplicating commerce records', async () => {
    await prisma.store.create({
      data: {
        name: 'Integration Store',
        email: 'orders@example.com',
      },
    })

    const order = await seedOrderForEmail('resend-safe', 'customer@example.com')
    const originalDelivery = await prisma.emailDelivery.create({
      data: {
        event: 'order.paid',
        template: 'order_confirmation',
        recipientEmail: 'customer@example.com',
        subject: `Order #${order.orderNumber} confirmation`,
        status: 'FAILED',
        provider: 'resend',
        providerMessageId: 'msg_original',
        attempts: 1,
        lastError: 'Mailbox unavailable',
        orderId: order.id,
      },
    })

    const beforeOrderCount = await prisma.order.count()
    const beforePaymentCount = await prisma.payment.count()

    const resendResult = await resendEmailDelivery(originalDelivery.id)
    expect(resendResult.success).toBe(true)

    const deliveries = await prisma.emailDelivery.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'asc' },
    })

    expect(deliveries).toHaveLength(2)
    expect(deliveries[0].id).toBe(originalDelivery.id)
    expect(deliveries[0].status).toBe('FAILED')
    expect(deliveries[1].id).not.toBe(originalDelivery.id)
    expect(deliveries[1].status).toBe('SENT')
    expect(deliveries[1].providerMessageId).toBeNull()
    expect(deliveries[1].attempts).toBe(1)

    expect(await prisma.order.count()).toBe(beforeOrderCount)
    expect(await prisma.payment.count()).toBe(beforePaymentCount)
  })

  it('updates delivery status from provider webhook events without recreating delivery rows', async () => {
    const delivery = await prisma.emailDelivery.create({
      data: {
        event: 'order.paid',
        template: 'order_confirmation',
        recipientEmail: 'customer@example.com',
        subject: 'Order confirmation',
        status: 'SENT',
        provider: 'resend',
        providerMessageId: 'msg_provider',
        attempts: 1,
      },
    })

    const bounced = await applyEmailProviderWebhookEvent({
      type: 'email.bounced',
      created_at: '2026-04-28T18:00:00.000Z',
      data: {
        email_id: 'msg_provider',
        to: ['customer@example.com'],
        bounce: {
          message: 'Recipient mailbox unavailable',
        },
      },
    })
    expect(bounced).toEqual({ handled: true })

    const afterBounce = await prisma.emailDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    })
    expect(afterBounce.status).toBe('BOUNCED')
    expect(afterBounce.lastError).toBe('Recipient mailbox unavailable')
    expect(afterBounce.bouncedAt).toBeInstanceOf(Date)

    const complained = await applyEmailProviderWebhookEvent({
      type: 'email.complained',
      created_at: '2026-04-28T18:05:00.000Z',
      data: {
        email_id: 'msg_provider',
        to: ['customer@example.com'],
      },
    })
    expect(complained).toEqual({ handled: true })

    const afterComplaint = await prisma.emailDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    })
    expect(afterComplaint.status).toBe('COMPLAINED')
    expect(afterComplaint.complainedAt).toBeInstanceOf(Date)
    expect(await prisma.emailDelivery.count()).toBe(1)
  })
})
