import type { ShippingLiveProvider } from '@prisma/client'

import { centsToDollars } from '@/lib/money'
import { prisma } from '@/lib/prisma'
import { getShippingProviderConnectionStatus } from '@/server/shipping/shipping-provider.service'
import { resolveLabelProvider } from '@/server/shipping/shipping-provider-selection'
import { getRuntimeProviderConnection } from '@/server/services/provider-connection.service'

function normalizeStatusLabel(value: string | null | undefined) {
  return String(value || '').toLowerCase().replaceAll('_', ' ')
}

function joinAddress(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ')
}

function resolveDeliveryStatus(input: {
  fulfillments: Array<{
    status: string
    trackingNumber: string | null
    deliveredAt: Date | null
  }>
}) {
  if (!input.fulfillments.length) return 'not-shipped'
  if (input.fulfillments.some((entry) => Boolean(entry.deliveredAt))) return 'delivered'
  if (
    input.fulfillments.some(
      (entry) =>
        ['SUCCESS', 'OPEN'].includes(String(entry.status || '').toUpperCase()) ||
        Boolean(entry.trackingNumber)
    )
  ) {
    return 'in-transit'
  }
  return 'not-shipped'
}

function resolveReturnStatus(returns: Array<{ status: string }>) {
  if (!returns.length) return 'none'
  return String(returns[0].status || 'none').toLowerCase()
}

export async function getAdminOrderDetailByOrderNumber(orderNumber: number) {
  const order = await prisma.order.findUnique({
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
      fulfillments: {
        include: {
          items: true,
          shippingLabels: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      shippingLabels: {
        orderBy: { createdAt: 'desc' },
      },
      events: { orderBy: { createdAt: 'desc' } },
      refunds: {
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      },
      returns: {
        include: {
          items: true,
          refund: { select: { id: true, amountCents: true, status: true, stripeRefundId: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      discountApplications: {
        include: { discount: true },
      },
    },
  })

  if (!order) return null

  const store = await prisma.store.findFirst({
    select: {
      shippingLiveProvider: true,
      shippingProviderUsage: true,
      labelProvider: true,
    },
  })
  const providerCandidates: ShippingLiveProvider[] = ['SHIPPO', 'EASYPOST']
  const providerStatuses = await Promise.all(
    providerCandidates.map(async (provider) => ({
      provider,
      status: await getShippingProviderConnectionStatus(provider),
    }))
  )
  const connectedProviders = providerStatuses
    .filter((entry) => Boolean(entry.status.connected))
    .map((entry) => entry.provider)

  const configuredLabelProvider = store ? resolveLabelProvider(store) : null
  const labelProvider =
    (configuredLabelProvider && connectedProviders.includes(configuredLabelProvider)
      ? configuredLabelProvider
      : connectedProviders[0] ?? configuredLabelProvider) || null
  const canBuyShippingLabelFromProvider = connectedProviders.length > 0

  const emailRuntime = await getRuntimeProviderConnection('RESEND')
  const emailProviderConfigured = Boolean(
    emailRuntime.source !== 'none' && emailRuntime.credentials?.API_KEY
  )
  const hasCustomerEmail = Boolean(order.email || order.customer?.email)

  const shippingAddress = order.addresses.find((entry) => entry.type === 'SHIPPING') || null
  const billingAddress = order.addresses.find((entry) => entry.type === 'BILLING') || null
  const lineItems = order.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    title: item.title,
    variant: item.variantTitle || item.variant?.title || '',
    variantTitle: item.variantTitle || item.variant?.title || '',
    sku: item.sku || item.variant?.sku || '',
    quantity: item.quantity,
    price: centsToDollars(item.priceCents),
    priceCents: item.priceCents,
    total: centsToDollars(item.totalCents),
    totalCents: item.totalCents,
    totalDiscount: centsToDollars(item.totalDiscountCents),
    totalDiscountCents: item.totalDiscountCents,
  }))

  const paymentSummary = {
    currency: order.currency,
    subtotal: centsToDollars(order.subtotalCents),
    subtotalCents: order.subtotalCents,
    shippingAmount: centsToDollars(order.shippingAmountCents),
    shippingAmountCents: order.shippingAmountCents,
    taxAmount: centsToDollars(order.taxAmountCents),
    taxAmountCents: order.taxAmountCents,
    discountAmount: centsToDollars(order.discountAmountCents),
    discountAmountCents: order.discountAmountCents,
    total: centsToDollars(order.totalCents),
    totalCents: order.totalCents,
  }

  const discounts = order.discountApplications.map((application) => ({
    id: application.id,
    discountId: application.discountId,
    title: application.discount?.title || 'Discount',
    code: application.discount?.code || null,
    method: application.discount?.method || null,
    amount: centsToDollars(application.amountCents),
    amountCents: application.amountCents,
  }))

  const payments = order.payments.map((payment) => ({
    id: payment.id,
    provider: payment.provider,
    status: payment.status,
    amount: centsToDollars(payment.amountCents),
    amountCents: payment.amountCents,
    currency: payment.currency,
    stripePaymentIntentId: payment.stripePaymentIntentId,
    stripeChargeId: payment.stripeChargeId,
    receiptUrl: payment.receiptUrl,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  }))

  const refunds = order.refunds.map((refund) => ({
    id: refund.id,
    status: refund.status,
    amount: centsToDollars(refund.amountCents),
    amountCents: refund.amountCents,
    reason: refund.reason,
    note: refund.note,
    paymentId: refund.paymentId,
    stripeRefundId: refund.stripeRefundId,
    restockItems: refund.restockItems,
    createdAt: refund.createdAt,
    updatedAt: refund.updatedAt,
    items: refund.items.map((item) => ({
      id: item.id,
      orderItemId: item.orderItemId,
      variantId: item.variantId,
      quantity: item.quantity,
      amount: centsToDollars(item.amountCents),
      amountCents: item.amountCents,
    })),
  }))

  const returns = order.returns.map((returnRecord) => ({
    id: returnRecord.id,
    status: returnRecord.status,
    reason: returnRecord.reason,
    note: returnRecord.note,
    refundId: returnRecord.refundId,
    createdAt: returnRecord.createdAt,
    updatedAt: returnRecord.updatedAt,
    items: returnRecord.items.map((item) => ({
      id: item.id,
      orderItemId: item.orderItemId,
      variantId: item.variantId,
      quantity: item.quantity,
      reason: item.reason,
    })),
    refund: returnRecord.refund
      ? {
          id: returnRecord.refund.id,
          status: returnRecord.refund.status,
          amount: centsToDollars(returnRecord.refund.amountCents),
          amountCents: returnRecord.refund.amountCents,
          stripeRefundId: returnRecord.refund.stripeRefundId,
        }
      : null,
  }))

  const fulfillments = order.fulfillments.map((fulfillment) => ({
    id: fulfillment.id,
    status: fulfillment.status,
    carrier: fulfillment.carrier,
    service: fulfillment.service,
    trackingNumber: fulfillment.trackingNumber,
    trackingUrl: fulfillment.trackingUrl,
    labelUrl: fulfillment.labelUrl,
    shippedAt: fulfillment.shippedAt,
    deliveredAt: fulfillment.deliveredAt,
    createdAt: fulfillment.createdAt,
    updatedAt: fulfillment.updatedAt,
    items: fulfillment.items.map((item) => ({
      id: item.id,
      orderItemId: item.orderItemId,
      variantId: item.variantId,
      quantity: item.quantity,
    })),
    shippingLabels: fulfillment.shippingLabels.map((label) => ({
      id: label.id,
      provider: label.provider,
      trackingNumber: label.trackingNumber,
      trackingUrl: label.trackingUrl,
      labelUrl: label.labelUrl,
      status: label.status,
      carrier: label.carrier,
      service: label.service,
      labelFormat: label.labelFormat,
      labelAmount: label.labelAmountCents == null ? null : centsToDollars(label.labelAmountCents),
      labelAmountCents: label.labelAmountCents,
      createdAt: label.createdAt,
    })),
  }))

  const timeline = order.events.map((entry) => ({
    id: entry.id,
    type: entry.type,
    event: entry.title,
    title: entry.title,
    detail: entry.detail,
    actorType: entry.actorType,
    actorId: entry.actorId,
    createdAt: entry.createdAt,
  }))

  const customerVisibleNotes = timeline
    .filter((entry) => entry.type === 'CUSTOMER_NOTE_ADDED' && Boolean(entry.detail))
    .map((entry) => ({
      id: entry.id,
      note: entry.detail as string,
      createdAt: entry.createdAt,
      actorType: entry.actorType,
    }))

  return {
    id: order.id,
    orderId: order.id,
    orderNumber: `#${order.orderNumber}`,
    orderNumberValue: order.orderNumber,
    displayNumber: `#${order.orderNumber}`,
    sourceChannel: order.channel || 'Online Store',
    channel: order.channel || 'Online Store',
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    status: normalizeStatusLabel(order.status),
    orderStatus: order.status,
    paymentStatus: normalizeStatusLabel(order.paymentStatus),
    paymentStatusRaw: order.paymentStatus,
    fulfillmentStatus: normalizeStatusLabel(order.fulfillmentStatus),
    fulfillmentStatusRaw: order.fulfillmentStatus,
    deliveryStatus: resolveDeliveryStatus({
      fulfillments: fulfillments.map((entry) => ({
        status: entry.status,
        trackingNumber: entry.trackingNumber,
        deliveredAt: entry.deliveredAt,
      })),
    }),
    returnStatus: resolveReturnStatus(returns),
    customer: order.customer
      ? {
          id: order.customer.id,
          name:
            [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') ||
            order.customer.email ||
            'Customer',
          firstName: order.customer.firstName,
          lastName: order.customer.lastName,
          email: order.customer.email,
          phone: order.customer.phone,
          acceptsMarketing: order.customer.acceptsMarketing,
          tags: order.customer.tags || [],
          note: order.customer.note,
          totalSpent: centsToDollars(order.customer.totalSpentCents),
          totalSpentCents: order.customer.totalSpentCents,
          orderCount: order.customer.orderCount,
          defaultAddress:
            joinAddress([
              order.customer.addresses.find((entry) => entry.isDefault)?.address1 ||
                order.customer.addresses[0]?.address1,
              order.customer.addresses.find((entry) => entry.isDefault)?.city ||
                order.customer.addresses[0]?.city,
              order.customer.addresses.find((entry) => entry.isDefault)?.province ||
                order.customer.addresses[0]?.province,
            ]) || null,
        }
      : null,
    customerNote: order.customer?.note ?? null,
    customerVisibleNotes,
    email: order.email || order.customer?.email || null,
    notes: order.note || '',
    note: order.note || '',
    tags: order.tags || [],
    lineItems,
    items: lineItems,
    discounts,
    discountApplications: discounts,
    shippingSummary: {
      amount: paymentSummary.shippingAmount,
      amountCents: paymentSummary.shippingAmountCents,
      methodName: order.shippingMethodName,
      rateType: order.shippingRateType,
      provider: order.shippingProvider,
      providerRateId: order.shippingProviderRateId,
      estimatedDeliveryText: order.estimatedDeliveryText,
      address: shippingAddress
        ? {
            firstName: shippingAddress.firstName,
            lastName: shippingAddress.lastName,
            company: shippingAddress.company,
            address1: shippingAddress.address1,
            address2: shippingAddress.address2,
            city: shippingAddress.city,
            province: shippingAddress.province,
            postalCode: shippingAddress.postalCode,
            country: shippingAddress.country,
            phone: shippingAddress.phone,
          }
        : null,
    },
    taxSummary: {
      amount: paymentSummary.taxAmount,
      amountCents: paymentSummary.taxAmountCents,
    },
    paymentSummary,
    payments,
    refunds,
    returns,
    fulfillments,
    shipments: fulfillments,
    shippingLabels: order.shippingLabels.map((label) => ({
      id: label.id,
      fulfillmentId: label.fulfillmentId,
      provider: label.provider,
      providerLabelId: label.providerLabelId,
      providerRateId: label.providerRateId,
      providerShipmentId: label.providerShipmentId,
      status: label.status,
      carrier: label.carrier,
      service: label.service,
      trackingNumber: label.trackingNumber,
      trackingUrl: label.trackingUrl,
      labelUrl: label.labelUrl,
      labelFormat: label.labelFormat,
      rateAmount: label.rateAmountCents == null ? null : centsToDollars(label.rateAmountCents),
      rateAmountCents: label.rateAmountCents,
      labelAmount: label.labelAmountCents == null ? null : centsToDollars(label.labelAmountCents),
      labelAmountCents: label.labelAmountCents,
      currency: label.currency,
      createdAt: label.createdAt,
      updatedAt: label.updatedAt,
    })),
    timeline,
    events: timeline,
    shippingAddress: joinAddress([
      shippingAddress?.address1,
      shippingAddress?.city,
      shippingAddress?.province,
    ]) || null,
    billingAddress: joinAddress([
      billingAddress?.address1,
      billingAddress?.city,
      billingAddress?.province,
    ]) || null,
    addresses: order.addresses,
    deliveryMethod: order.shippingAmountCents > 0 ? 'Standard shipping' : 'Free shipping',
    shippingMethodName: order.shippingMethodName,
    shippingRateType: order.shippingRateType,
    shippingProvider: order.shippingProvider,
    shippingProviderRateId: order.shippingProviderRateId,
    estimatedDeliveryText: order.estimatedDeliveryText,
    shippingCapabilities: {
      labelProvider: labelProvider || null,
      providerConnected: canBuyShippingLabelFromProvider,
      connectedProviders,
      providerConnectionByName: providerStatuses.reduce<Record<string, boolean>>((acc, entry) => {
        acc[entry.provider] = Boolean(entry.status.connected)
        return acc
      }, {}),
      providerUsage: store?.shippingProviderUsage || null,
      canBuyShippingLabel: canBuyShippingLabelFromProvider,
    },
    emailCapabilities: {
      hasCustomerEmail,
      providerConfigured: emailProviderConfigured,
    },
    total: paymentSummary.total,
    subtotal: paymentSummary.subtotal,
    shippingAmount: paymentSummary.shippingAmount,
    taxAmount: paymentSummary.taxAmount,
    discountAmount: paymentSummary.discountAmount,
    currency: order.currency,
    itemCount: lineItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    availableActions: {
      canManualFulfill: ['paid', 'partially refunded'].includes(
        normalizeStatusLabel(order.paymentStatus)
      ),
      canBuyShippingLabel:
        ['paid', 'partially refunded'].includes(normalizeStatusLabel(order.paymentStatus)) &&
        canBuyShippingLabelFromProvider,
      canRefund: ['paid', 'partially refunded'].includes(normalizeStatusLabel(order.paymentStatus)),
      canCreateReturn: true,
      canMarkPaid: ['pending', 'failed', 'voided'].includes(normalizeStatusLabel(order.paymentStatus)),
      canMarkPaymentPending: ['paid', 'partially refunded', 'refunded'].includes(
        normalizeStatusLabel(order.paymentStatus)
      ),
      canMarkFulfilled: ['unfulfilled', 'partially fulfilled'].includes(
        normalizeStatusLabel(order.fulfillmentStatus)
      ),
      canMarkUnfulfilled: ['fulfilled'].includes(normalizeStatusLabel(order.fulfillmentStatus)),
    },
  }
}
