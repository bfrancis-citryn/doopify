import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    emailDelivery: {
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
  sendTransactionalEmail: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/email/provider', () => ({ sendTransactionalEmail: mocks.sendTransactionalEmail }))

import {
  createEmailDelivery,
  getEmailDeliveries,
  markEmailDeliveryFailed,
  markEmailDeliverySent,
  sendTrackedEmail,
} from './email-delivery.service'

describe('email delivery service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mocks.prisma.emailDelivery.create.mockResolvedValue({ id: 'email-1', status: 'PENDING' })
    mocks.prisma.emailDelivery.update.mockResolvedValue({ id: 'email-1', status: 'SENT' })
    mocks.prisma.emailDelivery.count.mockResolvedValue(1)
    mocks.prisma.emailDelivery.findMany.mockResolvedValue([{ id: 'email-1', status: 'SENT' }])
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
})
