import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { prisma } from '@/lib/prisma'
import { queueOutboundWebhooks, processDueOutboundDeliveries, retryOutboundWebhookDelivery } from './outbound-webhook.service'
import { encrypt } from '@/server/utils/crypto'

const runIntegration =
  process.env.DATABASE_URL_TEST && process.env.DATABASE_URL === process.env.DATABASE_URL_TEST
    ? describe
    : describe.skip

async function cleanTestData() {
  await prisma.analyticsEvent.deleteMany()
  await prisma.outboundWebhookDelivery.deleteMany()
  await prisma.integrationSecret.deleteMany()
  await prisma.integrationEvent.deleteMany()
  await prisma.integration.deleteMany()
}

function orderPaidPayload() {
  return {
    orderId: 'order-1',
    orderNumber: 1001,
    email: 'customer@example.com',
    total: 50,
    currency: 'USD',
    items: [
      {
        title: 'Integration Tee',
        quantity: 1,
        price: 50,
      },
    ],
  }
}

runIntegration('outbound webhook integration', () => {
  beforeEach(async () => {
    await cleanTestData()
    vi.restoreAllMocks()
  }, 60_000)

  afterAll(async () => {
    await cleanTestData()
    await prisma.$disconnect()
  }, 60_000)

  it('processes due outbound deliveries idempotently across concurrent workers', async () => {
    await prisma.integration.create({
      data: {
        name: 'Webhook Worker Test',
        type: 'CUSTOM',
        webhookUrl: 'https://merchant.example/webhook',
        webhookSecret: encrypt('super-secret'),
        status: 'ACTIVE',
        events: {
          create: [{ event: 'order.paid' }],
        },
        secrets: {
          create: [{ key: 'HEADER_X-Test', value: encrypt('header-value') }],
        },
      },
    })

    await queueOutboundWebhooks('order.paid', orderPaidPayload())

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('OK', { status: 200 }))

    await Promise.all([
      processDueOutboundDeliveries(25),
      processDueOutboundDeliveries(25),
    ])

    const deliveries = await prisma.outboundWebhookDelivery.findMany()
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0].status).toBe('SUCCESS')
    expect(deliveries[0].attempts).toBe(1)
    expect(deliveries[0].statusCode).toBe(200)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('keeps manual retry idempotent under concurrent retry requests', async () => {
    const integration = await prisma.integration.create({
      data: {
        name: 'Manual Retry Test',
        type: 'CUSTOM',
        webhookUrl: 'https://merchant.example/webhook',
        webhookSecret: encrypt('super-secret'),
        status: 'ACTIVE',
      },
    })

    const delivery = await prisma.outboundWebhookDelivery.create({
      data: {
        integrationId: integration.id,
        event: 'order.paid',
        payload: JSON.stringify({
          event: 'order.paid',
          data: orderPaidPayload(),
          createdAt: new Date().toISOString(),
        }),
        status: 'FAILED',
        attempts: 1,
        lastError: 'Network timeout',
      },
    })

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('OK', { status: 200 }))

    const [firstRetry, secondRetry] = await Promise.all([
      retryOutboundWebhookDelivery(delivery.id),
      retryOutboundWebhookDelivery(delivery.id),
    ])

    const finalized = await prisma.outboundWebhookDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    })

    const successfulResults = [firstRetry, secondRetry].filter((result) => result?.status === 'SUCCESS')

    expect(successfulResults).toHaveLength(1)
    expect(finalized.status).toBe('SUCCESS')
    expect(finalized.attempts).toBe(2)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
