import { dollarsToCents } from '@/lib/money'
import { prisma } from '@/lib/prisma'
import { createOrder, createOrderEvent } from '@/server/services/order.service'

export class DraftOrderConversionError extends Error {
  code: 'INVALID_DRAFT' | 'DUPLICATE_CONVERSION' | 'CONVERSION_FAILED'

  constructor(
    code: 'INVALID_DRAFT' | 'DUPLICATE_CONVERSION' | 'CONVERSION_FAILED',
    message: string
  ) {
    super(message)
    this.name = 'DraftOrderConversionError'
    this.code = code
  }
}

type DraftConversionLineItemInput = {
  productId?: string | null
  variantId?: string | null
  title: string
  variantTitle?: string | null
  sku?: string | null
  quantity: number
  price: number
}

export type ConvertDraftOrderInput = {
  draftId: string
  customerId?: string | null
  email?: string | null
  notes?: string | null
  paymentStatus?: 'pending' | 'paid'
  shippingAmount?: number
  taxAmount?: number
  discountAmount?: number
  shippingAddress?: string | null
  billingAddress?: string | null
  lineItems: DraftConversionLineItemInput[]
}

export type ConvertDraftOrderResult = {
  duplicate: boolean
  orderId: string
  orderNumber: number
  redirectUrl: string
}

function normalizeText(value?: string | null) {
  return String(value || '').trim()
}

function buildAddress(address?: string | null) {
  const address1 = normalizeText(address)
  if (!address1) return undefined
  return { address1 }
}

function draftMarker(draftId: string) {
  return `draft:${draftId}`
}

export async function convertDraftOrder(input: ConvertDraftOrderInput): Promise<ConvertDraftOrderResult> {
  const draftId = normalizeText(input.draftId)
  if (!draftId) {
    throw new DraftOrderConversionError('INVALID_DRAFT', 'Draft ID is required')
  }

  if (!Array.isArray(input.lineItems) || !input.lineItems.length) {
    throw new DraftOrderConversionError('INVALID_DRAFT', 'Draft order must include at least one line item')
  }

  const duplicate = await prisma.order.findFirst({
    where: {
      events: {
        some: {
          type: 'DRAFT_ORDER_CONVERTED',
          detail: draftMarker(draftId),
        },
      },
    },
    select: {
      id: true,
      orderNumber: true,
    },
  })

  if (duplicate) {
    return {
      duplicate: true,
      orderId: duplicate.id,
      orderNumber: duplicate.orderNumber,
      redirectUrl: `/orders/${duplicate.orderNumber}`,
    }
  }

  const orderItems = input.lineItems.map((item) => ({
    productId: item.productId || undefined,
    variantId: item.variantId || undefined,
    title: normalizeText(item.title) || 'Line item',
    variantTitle: normalizeText(item.variantTitle) || undefined,
    sku: normalizeText(item.sku) || undefined,
    quantity: Number(item.quantity),
    priceCents: dollarsToCents(item.price),
  }))

  if (orderItems.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
    throw new DraftOrderConversionError('INVALID_DRAFT', 'Draft line item quantities must be positive integers')
  }

  try {
    const order = await createOrder({
      customerId: input.customerId || undefined,
      email: normalizeText(input.email) || undefined,
      items: orderItems,
      paymentStatus: String(input.paymentStatus || 'pending').toLowerCase() === 'paid' ? 'PAID' : 'PENDING',
      taxAmountCents: dollarsToCents(input.taxAmount ?? 0),
      shippingAmountCents: dollarsToCents(input.shippingAmount ?? 0),
      discountAmountCents: dollarsToCents(input.discountAmount ?? 0),
      shippingAddress: buildAddress(input.shippingAddress),
      billingAddress: buildAddress(input.billingAddress),
    })

    await prisma.order.update({
      where: { id: order.id },
      data: {
        channel: 'draft_orders',
        note: normalizeText(input.notes) || order.note,
        tags: {
          set: Array.from(new Set([...(order.tags || []), 'Draft converted'])),
        },
      },
    })

    await createOrderEvent(order.id, {
      type: 'DRAFT_ORDER_CONVERTED',
      title: 'Draft order converted',
      detail: draftMarker(draftId),
      actorType: 'STAFF',
    })

    return {
      duplicate: false,
      orderId: order.id,
      orderNumber: order.orderNumber,
      redirectUrl: `/orders/${order.orderNumber}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to convert draft order'
    throw new DraftOrderConversionError('CONVERSION_FAILED', message)
  }
}
