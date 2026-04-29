import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    emailDelivery: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
    },
  },
  sendTransactionalEmail: vi.fn(),
  getOrderById: vi.fn(),
  buildOrderConfirmationEmailMessage: vi.fn(),
  emitInternalEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/email/provider', () => ({ sendTransactionalEmail: mocks.sendTransactionalEmail }))
vi.mock('@/server/services/order.service', () => ({ getOrderById: mocks.getOrderById }))
vi.mock('@/server/services/email-template.service', () => ({
  buildOrderConfirmationEmailMessage: mocks.buildOrderConfirmationEmailMessage,
}))
vi.mock('@/server/events/dispatcher', () => ({
  emitInternalEvent: mocks.emitInternalEvent,
}))

import {
  applyEmailProviderWebhookEvent,
  createEmailDelivery,
  getEmailDeliveryById,
  getEmailDeliveries,
  markEmailDeliveryFailed,
  markEmailDeliverySent,
  parseEmailProviderWebhookPayload,
  resendEmailDelivery,
  sendTrackedEmail,
} from './email-delivery.service'

describe('email delivery service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mocks.prisma.emailDelivery.create.mockResolvedValue({ id: 'email-1', status: 'PENDING' })
    mocks.prisma.emailDelivery.update.mockResolvedValue({ id: 'email-1', status: 'SENT' })
    mocks.prisma.emailDelivery.updateMany.mockResolvedValue({ count: 1 })
    mocks.prisma.emailDelivery.count.mockResolvedValue(1)
    mocks.prisma.emailDelivery.findMany.mockResolvedValue([{ id: 'email-1', status: 'SENT' }])
    mocks.prisma.emailDelivery.findUnique.mockResolvedValue(null)
    mocks.prisma.order.findUnique.mockResolvedValue(null)
    mocks.getOrderById.mockResolvedValue(null)
    mocks.buildOrderConfirmationEmailMessage.mockResolvedValue({
      from: 'orders@example.com',
      subject: 'Store order #1001 confirmation',
      html: '<p>Order confirmation</p>',
    })
  })

  it('creates a pending delivery record', async () => {
    await createEmailDelivery({
      event: 'order.paid',
      template: 'order_confirmation',
      recipientEmail: 'customer@example.com',
      subject: 'Order confirmation',
      orderId: 'order-1',
    })

    expect(mocks.prisma.emailDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: 'order.paid',
        template: 'order_confirmation',
        recipientEmail: 'customer@example.com',
        subject: 'Order confirmation',
        provider: 'resend',
        status: 'PENDING',
        orderId: 'order-1',
      }),
    })
  })

  it('marks a delivery sent with provider metadata', async () => {
    await markEmailDeliverySent({ deliveryId: 'email-1', provider: 'resend', providerMessageId: 'resend-1' })

    expect(mocks.prisma.emailDelivery.update).toHaveBeenCalledWith({
      where: { id: 'email-1' },
      data: expect.objectContaining({
        status: 'SENT',
        provider: 'resend',
        providerMessageId: 'resend-1',
        sentAt: expect.any(Date),
        lastError: null,
        attempts: { increment: 1 },
      }),
    })
  })

  it('marks a delivery failed without hiding provider errors', async () => {
    await markEmailDeliveryFailed({ deliveryId: 'email-1', error: new Error('Provider unavailable') })

    expect(mocks.prisma.emailDelivery.update).toHaveBeenCalledWith({
      where: { id: 'email-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        lastError: 'Provider unavailable',
        attempts: { increment: 1 },
        nextRetryAt: null,
      }),
    })
  })

  it('sends a tracked email and marks it sent', async () => {
    mocks.sendTransactionalEmail.mockResolvedValue({ provider: 'resend', providerMessageId: 'resend-1' })

    await sendTrackedEmail({
      event: 'order.paid',
      template: 'order_confirmation',
      recipientEmail: 'customer@example.com',
      subject: 'Order confirmation',
      from: 'orders@example.com',
      html: '<p>Confirmed</p>',
      orderId: 'order-1',
    })

    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith({
      from: 'orders@example.com',
      to: ['customer@example.com'],
      subject: 'Order confirmation',
      html: '<p>Confirmed</p>',
    })
    expect(mocks.prisma.emailDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'SENT', providerMessageId: 'resend-1' }),
    }))
  })

  it('marks a tracked email failed and rethrows provider errors', async () => {
    mocks.sendTransactionalEmail.mockRejectedValue(new Error('Resend failed'))

    await expect(sendTrackedEmail({
      event: 'order.paid',
      template: 'order_confirmation',
      recipientEmail: 'customer@example.com',
      subject: 'Order confirmation',
      from: 'orders@example.com',
      html: '<p>Confirmed</p>',
      orderId: 'order-1',
    })).rejects.toThrow('Resend failed')

    expect(mocks.prisma.emailDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED', lastError: 'Resend failed' }),
    }))
  })

  it('lists safe delivery records with pagination', async () => {
    const result = await getEmailDeliveries({ status: 'SENT', page: 2, pageSize: 10 })

    expect(mocks.prisma.emailDelivery.count).toHaveBeenCalledWith({ where: { status: 'SENT' } })
    expect(mocks.prisma.emailDelivery.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'SENT' },
      skip: 10,
      take: 10,
    }))
    expect(result.pagination).toEqual({ page: 2, pageSize: 10, total: 1, totalPages: 1 })
  })

  it('returns delivery diagnostics with resend policy', async () => {
    mocks.prisma.emailDelivery.findUnique.mockResolvedValue({
      id: 'email-1',
      event: 'order.paid',
      template: 'order_confirmation',
      recipientEmail: 'customer@example.com',
      subject: 'Order confirmation',
      status: 'FAILED',
      provider: 'resend',
      providerMessageId: null,
      attempts: 1,
      lastError: 'Bounce',
      nextRetryAt: null,
      sentAt: null,
      bouncedAt: null,
      complainedAt: null,
      orderId: 'order-1',
      customerId: null,
      refundId: null,
      returnId: null,
      createdAt: new Date('2026-04-28T00:00:00.000Z'),
      updatedAt: new Date('2026-04-28T00:00:00.000Z'),
    })
    mocks.prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 1001,
      status: 'OPEN',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'UNFULFILLED',
      total: 120,
      currency: 'USD',
      createdAt: new Date('2026-04-28T00:00:00.000Z'),
    })

    const result = await getEmailDeliveryById('email-1')

    expect(result?.resendPolicy.canResend).toBe(true)
    expect(result?.resendPolicy.blockers).toEqual([])
    expect(result?.related.order).toEqual(expect.objectContaining({ id: 'order-1', orderNumber: 1001 }))
  })

  it('rejects resend when status is not eligible', async () => {
    mocks.prisma.emailDelivery.findUnique.mockResolvedValue({
      id: 'email-1',
      event: 'order.paid',
      template: 'order_confirmation',
      recipientEmail: 'customer@example.com',
      subject: 'Order confirmation',
      status: 'SENT',
      provider: 'resend',
      providerMessageId: 'provider-1',
      attempts: 1,
      lastError: null,
      nextRetryAt: null,
      sentAt: new Date('2026-04-28T00:00:00.000Z'),
      bouncedAt: null,
      complainedAt: null,
      orderId: 'order-1',
      customerId: null,
      refundId: null,
      returnId: null,
      createdAt: new Date('2026-04-28T00:00:00.000Z'),
      updatedAt: new Date('2026-04-28T00:00:00.000Z'),
    })

    const result = await resendEmailDelivery('email-1')

    expect(result).toEqual(expect.objectContaining({
      success: false,
      reason: 'NOT_RESENDABLE',
    }))
    expect(mocks.prisma.emailDelivery.create).not.toHaveBeenCalled()
  })

  it('resends an eligible order confirmation as a new tracked delivery', async () => {
    mocks.prisma.emailDelivery.findUnique.mockResolvedValue({
      id: 'email-1',
      event: 'order.paid',
      template: 'order_confirmation',
      recipientEmail: 'customer@example.com',
      subject: 'Order confirmation',
      status: 'FAILED',
      provider: 'resend',
      providerMessageId: null,
      attempts: 1,
      lastError: 'Provider unavailable',
      nextRetryAt: null,
      sentAt: null,
      bouncedAt: null,
      complainedAt: null,
      orderId: 'order-1',
      customerId: null,
      refundId: null,
      returnId: null,
      createdAt: new Date('2026-04-28T00:00:00.000Z'),
      updatedAt: new Date('2026-04-28T00:00:00.000Z'),
    })
    mocks.getOrderById.mockResolvedValue({
      id: 'order-1',
      orderNumber: 1001,
      email: 'customer@example.com',
      currency: 'USD',
      total: 120,
      items: [{ title: 'Tee', variantTitle: 'Blue', quantity: 2, price: 60 }],
      addresses: [{
        type: 'SHIPPING',
        firstName: 'Alex',
        lastName: 'Rivera',
        address1: '123 Main St',
        city: 'Los Angeles',
        province: 'CA',
        postalCode: '90001',
        country: 'US',
      }],
    })
    mocks.sendTransactionalEmail.mockResolvedValue({ provider: 'resend', providerMessageId: 'resend-2' })
    mocks.prisma.emailDelivery.create.mockResolvedValue({ id: 'email-2', status: 'PENDING' })
    mocks.prisma.emailDelivery.update.mockResolvedValue({ id: 'email-2', status: 'SENT' })

    const result = await resendEmailDelivery('email-1')

    expect(result).toEqual({
      success: true,
      delivery: { id: 'email-2', status: 'SENT' },
    })
    expect(mocks.buildOrderConfirmationEmailMessage).toHaveBeenCalled()
    expect(mocks.prisma.emailDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: 'order.paid',
        template: 'order_confirmation',
        recipientEmail: 'customer@example.com',
        provider: 'resend',
        status: 'PENDING',
      }),
    })
  })

  it('parses provider webhook payloads safely', () => {
    expect(parseEmailProviderWebhookPayload('{"type":"email.bounced","data":{"email_id":"msg_1"}}')).toEqual({
      type: 'email.bounced',
      data: { email_id: 'msg_1' },
    })
    expect(parseEmailProviderWebhookPayload('{"noType":true}')).toBeNull()
    expect(parseEmailProviderWebhookPayload('not json')).toBeNull()
  })

  it('marks a delivery bounced from provider webhook event', async () => {
    const result = await applyEmailProviderWebhookEvent({
      type: 'email.bounced',
      created_at: '2026-04-28T18:00:00.000Z',
      data: {
        email_id: 'provider-1',
        to: ['customer@example.com'],
        bounce: { message: 'Mailbox unavailable' },
      },
    })

    expect(result).toEqual({ handled: true })
    expect(mocks.prisma.emailDelivery.updateMany).toHaveBeenCalledWith({
      where: {
        provider: 'resend',
        providerMessageId: 'provider-1',
        recipientEmail: 'customer@example.com',
      },
      data: expect.objectContaining({
        status: 'BOUNCED',
        lastError: 'Mailbox unavailable',
        nextRetryAt: null,
        bouncedAt: expect.any(Date),
      }),
    })
  })

  it('marks a delivery complained from provider webhook event', async () => {
    const result = await applyEmailProviderWebhookEvent({
      type: 'email.complained',
      created_at: '2026-04-28T18:05:00.000Z',
      data: {
        email_id: 'provider-2',
      },
    })

    expect(result).toEqual({ handled: true })
    expect(mocks.prisma.emailDelivery.updateMany).toHaveBeenCalledWith({
      where: {
        provider: 'resend',
        providerMessageId: 'provider-2',
      },
      data: expect.objectContaining({
        status: 'COMPLAINED',
        lastError: 'Recipient reported this email as spam',
        nextRetryAt: null,
        complainedAt: expect.any(Date),
      }),
    })
  })

  it('ignores unsupported provider webhook events', async () => {
    const result = await applyEmailProviderWebhookEvent({
      type: 'email.delivered',
      data: {
        email_id: 'provider-3',
      },
    })

    expect(result).toEqual({ handled: false, reason: 'UNSUPPORTED_EVENT' })
    expect(mocks.prisma.emailDelivery.updateMany).not.toHaveBeenCalled()
  })
})
