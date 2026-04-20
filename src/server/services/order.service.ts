import { prisma } from '@/lib/prisma'
import type { OrderStatus, PaymentStatus, FulfillmentStatus, Prisma } from '@prisma/client'

// ── List orders ───────────────────────────────────────────────────────────────
export async function getOrders(params: {
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  fulfillmentStatus?: FulfillmentStatus
  search?: string
  page?: number
  pageSize?: number
}) {
  const { status, paymentStatus, fulfillmentStatus, search, page = 1, pageSize = 20 } = params

  const where: Prisma.OrderWhereInput = {
    ...(status && { status }),
    ...(paymentStatus && { paymentStatus }),
    ...(fulfillmentStatus && { fulfillmentStatus }),
    ...(search && {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
        { customer: { firstName: { contains: search, mode: 'insensitive' } } },
        { orderNumber: isNaN(Number(search)) ? undefined : { equals: Number(search) } },
      ].filter(Boolean) as Prisma.OrderWhereInput['OR'],
    }),
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: true,
        items: true,
        addresses: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ])

  return {
    orders,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  }
}

// ── Get single order by orderNumber ──────────────────────────────────────────
export async function getOrder(orderNumber: number) {
  return prisma.order.findUnique({
    where: { orderNumber },
    include: {
      customer: { include: { addresses: true } },
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
      addresses: true,
      payments: true,
      fulfillments: { include: { items: true } },
      events: { orderBy: { createdAt: 'desc' } },
      refunds: true,
      returns: true,
      discountApplications: { include: { discount: true } },
    },
  })
}

// ── Create order (called from Stripe webhook) ─────────────────────────────────
export async function createOrder(data: {
  customerId?: string
  email?: string
  items: Array<{
    productId?: string
    variantId?: string
    title: string
    variantTitle?: string
    sku?: string
    price: number
    quantity: number
  }>
  shippingAddress?: {
    firstName?: string
    lastName?: string
    address1?: string
    address2?: string
    city?: string
    province?: string
    postalCode?: string
    country?: string
    phone?: string
  }
  subtotal: number
  taxAmount?: number
  shippingAmount?: number
  discountAmount?: number
  total: number
  currency?: string
  stripePaymentIntentId?: string
}) {
  const order = await prisma.order.create({
    data: {
      customerId: data.customerId,
      email: data.email,
      status: 'OPEN',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'UNFULFILLED',
      subtotal: data.subtotal,
      taxAmount: data.taxAmount ?? 0,
      shippingAmount: data.shippingAmount ?? 0,
      discountAmount: data.discountAmount ?? 0,
      total: data.total,
      currency: data.currency ?? 'USD',
      items: {
        create: data.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          title: item.title,
          variantTitle: item.variantTitle,
          sku: item.sku,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
        })),
      },
      addresses: data.shippingAddress
        ? {
            create: {
              type: 'SHIPPING',
              ...data.shippingAddress,
            },
          }
        : undefined,
      payments: data.stripePaymentIntentId
        ? {
            create: {
              provider: 'stripe',
              amount: data.total,
              currency: data.currency ?? 'USD',
              status: 'PAID',
              stripePaymentIntentId: data.stripePaymentIntentId,
            },
          }
        : undefined,
      events: {
        create: {
          type: 'ORDER_PLACED',
          title: 'Order placed',
          detail: 'Order was created via online checkout',
          actorType: 'SYSTEM',
        },
      },
    },
    include: {
      items: true,
      addresses: true,
      payments: true,
      events: true,
    },
  })

  // Update customer totals
  if (data.customerId) {
    await prisma.customer.update({
      where: { id: data.customerId },
      data: {
        orderCount: { increment: 1 },
        totalSpent: { increment: data.total },
      },
    })
  }

  return order
}

// ── Add an event to the order timeline ───────────────────────────────────────
export async function createOrderEvent(
  orderId: string,
  data: { type: string; title: string; detail?: string; actorType?: 'SYSTEM' | 'STAFF' | 'CUSTOMER'; actorId?: string }
) {
  return prisma.orderEvent.create({
    data: {
      orderId,
      type: data.type,
      title: data.title,
      detail: data.detail,
      actorType: data.actorType ?? 'SYSTEM',
      actorId: data.actorId,
    },
  })
}

// ── Update payment status ─────────────────────────────────────────────────────
export async function updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus },
  })

  await createOrderEvent(orderId, {
    type: 'PAYMENT_STATUS_UPDATED',
    title: `Payment status updated to ${paymentStatus}`,
    actorType: 'STAFF',
  })

  return order
}

// ── Update fulfillment status ─────────────────────────────────────────────────
export async function updateFulfillmentStatus(orderId: string, fulfillmentStatus: FulfillmentStatus) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { fulfillmentStatus },
  })

  await createOrderEvent(orderId, {
    type: 'FULFILLMENT_STATUS_UPDATED',
    title: `Fulfillment status updated to ${fulfillmentStatus}`,
    actorType: 'STAFF',
  })

  return order
}

// ── Create fulfillment ────────────────────────────────────────────────────────
export async function createFulfillment(data: {
  orderId: string
  items: Array<{ orderItemId: string; variantId?: string; quantity: number }>
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
}) {
  const fulfillment = await prisma.fulfillment.create({
    data: {
      orderId: data.orderId,
      status: 'SUCCESS',
      carrier: data.carrier,
      trackingNumber: data.trackingNumber,
      trackingUrl: data.trackingUrl,
      shippedAt: new Date(),
      items: {
        create: data.items.map((item) => ({
          orderItemId: item.orderItemId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      },
    },
    include: { items: true },
  })

  // Update order fulfillment status
  await prisma.order.update({
    where: { id: data.orderId },
    data: { fulfillmentStatus: 'FULFILLED' },
  })

  await createOrderEvent(data.orderId, {
    type: 'FULFILLMENT_CREATED',
    title: data.trackingNumber
      ? `Fulfillment created with tracking ${data.trackingNumber}`
      : 'Fulfillment created',
    actorType: 'STAFF',
  })

  return fulfillment
}

// ── Analytics aggregates ──────────────────────────────────────────────────────
export async function getAnalytics() {
  const [
    totalRevenue,
    orderCount,
    customerCount,
    topProducts,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { paymentStatus: 'PAID' },
      _sum: { total: true },
    }),
    prisma.order.count(),
    prisma.customer.count(),
    prisma.orderItem.groupBy({
      by: ['productId', 'title'],
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    }),
  ])

  const totalRevenueAmount = totalRevenue._sum.total ?? 0
  const aov = orderCount > 0 ? totalRevenueAmount / orderCount : 0

  return {
    totalRevenue: totalRevenueAmount,
    orderCount,
    customerCount,
    averageOrderValue: aov,
    topProducts,
  }
}
