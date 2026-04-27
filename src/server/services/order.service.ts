import { Prisma, type FulfillmentStatus, type OrderStatus, type PaymentStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { CheckoutAppliedDiscount } from '@/server/checkout/pricing'
import { emitInternalEvent } from '@/server/events/dispatcher'

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

function parseOrderNumberSearch(search?: string) {
  const query = search?.trim()
  if (!query || !/^\d+$/.test(query)) {
    return undefined
  }

  const value = Number(query)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function buildOrderTotals(input: {
  items: Array<{ price: number; quantity: number }>
  taxAmount?: number
  shippingAmount?: number
  discountAmount?: number
}) {
  const subtotal = roundCurrency(
    input.items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0)
  )
  const taxAmount = roundCurrency(input.taxAmount ?? 0)
  const shippingAmount = roundCurrency(input.shippingAmount ?? 0)
  const discountAmount = roundCurrency(input.discountAmount ?? 0)
  const total = roundCurrency(subtotal + taxAmount + shippingAmount - discountAmount)

  return {
    subtotal,
    taxAmount,
    shippingAmount,
    discountAmount,
    total,
  }
}

async function incrementDiscountUsageWithCap(input: {
  tx: Prisma.TransactionClient
  discountId: string
}) {
  const discount = await input.tx.discount.findUnique({
    where: { id: input.discountId },
    select: {
      id: true,
      usageCount: true,
      usageLimit: true,
    },
  })

  if (!discount) {
    throw new Error(`Discount ${input.discountId} could not be found`)
  }

  if (discount.usageLimit == null) {
    await input.tx.discount.update({
      where: { id: input.discountId },
      data: { usageCount: { increment: 1 } },
    })
    return
  }

  if (discount.usageCount >= discount.usageLimit) {
    throw new Error(`Discount usage limit reached for ${input.discountId}`)
  }

  const updated = await input.tx.discount.updateMany({
    where: {
      id: input.discountId,
      usageCount: discount.usageCount,
      usageLimit: discount.usageLimit,
    },
    data: { usageCount: { increment: 1 } },
  })

  if (updated.count === 0) {
    throw new Error(`Discount usage limit reached for ${input.discountId}`)
  }
}

export async function getOrders(params: {
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  fulfillmentStatus?: FulfillmentStatus
  search?: string
  page?: number
  pageSize?: number
}) {
  const { status, paymentStatus, fulfillmentStatus, search, page = 1, pageSize = 20 } = params
  const orderNumber = parseOrderNumberSearch(search)
  const trimmedSearch = search?.trim()

  const where: Prisma.OrderWhereInput = {
    ...(status && { status }),
    ...(paymentStatus && { paymentStatus }),
    ...(fulfillmentStatus && { fulfillmentStatus }),
    ...(trimmedSearch && {
      OR: [
        { email: { contains: trimmedSearch, mode: 'insensitive' } },
        { customer: { email: { contains: trimmedSearch, mode: 'insensitive' } } },
        { customer: { firstName: { contains: trimmedSearch, mode: 'insensitive' } } },
        ...(orderNumber ? [{ orderNumber: { equals: orderNumber } }] : []),
      ],
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

export async function getOrderById(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      addresses: true,
      payments: true,
      events: { orderBy: { createdAt: 'desc' } },
    },
  })
}

export async function getOrderByPaymentIntentId(paymentIntentId: string) {
  return prisma.order.findFirst({
    where: {
      payments: {
        some: {
          stripePaymentIntentId: paymentIntentId,
        },
      },
    },
    include: {
      items: true,
      addresses: true,
      payments: true,
      events: { orderBy: { createdAt: 'desc' } },
    },
  })
}

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
    company?: string
    address1?: string
    address2?: string
    city?: string
    province?: string
    postalCode?: string
    country?: string
    phone?: string
  }
  billingAddress?: {
    firstName?: string
    lastName?: string
    company?: string
    address1?: string
    address2?: string
    city?: string
    province?: string
    postalCode?: string
    country?: string
    phone?: string
  }
  taxAmount?: number
  shippingAmount?: number
  discountAmount?: number
  currency?: string
  discountApplications?: CheckoutAppliedDiscount[]
  stripePaymentIntentId?: string
  stripeChargeId?: string
  paymentStatus?: PaymentStatus
  fulfillmentStatus?: FulfillmentStatus
  status?: OrderStatus
}) {
  if (!data.items.length) {
    throw new Error('Cannot create an order without line items')
  }

  if (data.stripePaymentIntentId) {
    const existingOrder = await getOrderByPaymentIntentId(data.stripePaymentIntentId)
    if (existingOrder) {
      return existingOrder
    }
  }

  const totals = buildOrderTotals({
    items: data.items,
    taxAmount: data.taxAmount,
    shippingAmount: data.shippingAmount,
    discountAmount: data.discountAmount,
  })

  const paymentStatus = data.paymentStatus ?? 'PAID'
  const fulfillmentStatus = data.fulfillmentStatus ?? 'UNFULFILLED'
  const orderStatus = data.status ?? 'OPEN'
  const discountApplications = data.discountApplications ?? []
  const paidDiscountApplications = paymentStatus === 'PAID' ? discountApplications : []

  try {
    const order = await prisma.$transaction(async (tx) => {
      for (const item of data.items) {
        if (!item.variantId) continue

        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, inventory: { gte: item.quantity } },
          data: { inventory: { decrement: item.quantity } },
        })

        if (updated.count === 0) {
          throw new Error(`Insufficient inventory for variant ${item.variantId}`)
        }
      }

      const createdOrder = await tx.order.create({
        data: {
          customerId: data.customerId,
          email: data.email,
          status: orderStatus,
          paymentStatus,
          fulfillmentStatus,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          shippingAmount: totals.shippingAmount,
          discountAmount: totals.discountAmount,
          total: totals.total,
          currency: (data.currency ?? 'USD').toUpperCase(),
          channel: 'online',
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              title: item.title,
              variantTitle: item.variantTitle,
              sku: item.sku,
              price: item.price,
              quantity: item.quantity,
              total: roundCurrency(item.price * item.quantity),
            })),
          },
          addresses:
            data.shippingAddress || data.billingAddress
              ? {
                  create: [
                    ...(data.shippingAddress
                      ? [
                          {
                            type: 'SHIPPING' as const,
                            ...data.shippingAddress,
                          },
                        ]
                      : []),
                    ...(data.billingAddress
                      ? [
                          {
                            type: 'BILLING' as const,
                            ...data.billingAddress,
                          },
                        ]
                      : []),
                  ],
                }
              : undefined,
          payments: data.stripePaymentIntentId
            ? {
                create: {
                  provider: 'stripe',
                  amount: totals.total,
                  currency: (data.currency ?? 'USD').toUpperCase(),
                  status: paymentStatus,
                  stripePaymentIntentId: data.stripePaymentIntentId,
                  stripeChargeId: data.stripeChargeId,
                },
              }
            : undefined,
          discountApplications: paidDiscountApplications.length
            ? {
                create: paidDiscountApplications.map((discount) => ({
                  discountId: discount.discountId,
                  amount: roundCurrency(discount.amount),
                })),
              }
            : undefined,
          events: {
            create: [
              {
                type: 'ORDER_PLACED',
                title: 'Order placed',
                detail: 'Order was created via online checkout',
                actorType: 'SYSTEM',
              },
              ...(paymentStatus === 'PAID'
                ? [
                    {
                      type: 'PAYMENT_RECEIVED',
                      title: 'Payment received',
                      detail: data.stripePaymentIntentId
                        ? `Stripe payment intent ${data.stripePaymentIntentId} succeeded`
                        : 'Payment received',
                      actorType: 'SYSTEM' as const,
                    },
                  ]
                : []),
            ],
          },
        },
        include: {
          items: true,
          addresses: true,
          payments: true,
          events: true,
        },
      })

      if (data.customerId) {
        await tx.customer.update({
          where: { id: data.customerId },
          data: {
            orderCount: { increment: 1 },
            ...(paymentStatus === 'PAID'
              ? {
                  totalSpent: { increment: totals.total },
                }
              : {}),
          },
        })
      }

      if (paymentStatus === 'PAID') {
        for (const discount of paidDiscountApplications) {
          await incrementDiscountUsageWithCap({
            tx,
            discountId: discount.discountId,
          })
        }
      }

      return createdOrder
    })

    await emitInternalEvent('order.created', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      total: order.total,
      currency: order.currency,
    })

    if (order.paymentStatus === 'PAID') {
      const shippingAddress = order.addresses.find((address) => address.type === 'SHIPPING')

      await emitInternalEvent('order.paid', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        email: order.email,
        total: order.total,
        currency: order.currency,
        items: order.items.map((item) => ({
          title: item.title,
          variantTitle: item.variantTitle,
          quantity: item.quantity,
          price: item.price,
        })),
        shippingAddress: shippingAddress
          ? {
              firstName: shippingAddress.firstName,
              lastName: shippingAddress.lastName,
              address1: shippingAddress.address1,
              city: shippingAddress.city,
              province: shippingAddress.province,
              postalCode: shippingAddress.postalCode,
              country: shippingAddress.country,
            }
          : undefined,
      })
    }

    return order
  } catch (error) {
    if (data.stripePaymentIntentId) {
      const existingOrder = await getOrderByPaymentIntentId(data.stripePaymentIntentId)
      if (existingOrder) {
        return existingOrder
      }
    }

    throw error
  }
}

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

export async function updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus },
    include: {
      items: true,
      addresses: true,
    },
  })

  await createOrderEvent(orderId, {
    type: 'PAYMENT_STATUS_UPDATED',
    title: `Payment status updated to ${paymentStatus}`,
    actorType: 'STAFF',
  })

  if (paymentStatus === 'PAID') {
    const shippingAddress = order.addresses.find((address) => address.type === 'SHIPPING')

    await emitInternalEvent('order.paid', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      total: order.total,
      currency: order.currency,
      items: order.items.map((item) => ({
        title: item.title,
        variantTitle: item.variantTitle,
        quantity: item.quantity,
        price: item.price,
      })),
      shippingAddress: shippingAddress
        ? {
            firstName: shippingAddress.firstName,
            lastName: shippingAddress.lastName,
            address1: shippingAddress.address1,
            city: shippingAddress.city,
            province: shippingAddress.province,
            postalCode: shippingAddress.postalCode,
            country: shippingAddress.country,
          }
        : undefined,
    })
  }

  return order
}

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

export async function createFulfillment(data: {
  orderId: string
  items: Array<{ orderItemId: string; variantId?: string; quantity: number }>
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
}) {
  const fulfillment = await prisma.$transaction(async (tx) => {
    const createdFulfillment = await tx.fulfillment.create({
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

    await tx.order.update({
      where: { id: data.orderId },
      data: { fulfillmentStatus: 'FULFILLED' },
    })

    await tx.orderEvent.create({
      data: {
        orderId: data.orderId,
        type: 'FULFILLMENT_CREATED',
        title: data.trackingNumber
          ? `Fulfillment created with tracking ${data.trackingNumber}`
          : 'Fulfillment created',
        actorType: 'STAFF',
      },
    })

    return createdFulfillment
  })

  await emitInternalEvent('fulfillment.created', {
    fulfillmentId: fulfillment.id,
    orderId: data.orderId,
    trackingNumber: data.trackingNumber,
  })

  return fulfillment
}

export async function getAnalytics() {
  const [totalRevenue, orderCount, customerCount, topProducts] = await Promise.all([
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
