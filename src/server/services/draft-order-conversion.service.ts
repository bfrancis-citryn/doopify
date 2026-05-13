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
  price?: number
  unitPrice?: number
  originalPrice?: number
  priceOverridden?: boolean
  priceOverrideAmount?: number | null
  priceOverrideReason?: string | null
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

function parseNonNegativeMoney(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
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

  const overrideAuditEvents: Array<{
    title: string
    sku?: string
    reason: string
    originalPrice: number
    finalPrice: number
  }> = []

  const orderItems = input.lineItems.map((item) => {
    const quantity = Number(item.quantity)
    const originalPrice =
      parseNonNegativeMoney(item.originalPrice) ??
      parseNonNegativeMoney(item.unitPrice)

    if (originalPrice == null) {
      throw new DraftOrderConversionError(
        'INVALID_DRAFT',
        'Draft line items must include a non-negative snapshot/catalog unit price'
      )
    }

    const priceOverridden = Boolean(item.priceOverridden)
    let finalPrice = originalPrice

    if (priceOverridden) {
      const overrideReason = normalizeText(item.priceOverrideReason)
      const overrideAmount = parseNonNegativeMoney(item.priceOverrideAmount)

      if (!overrideReason) {
        throw new DraftOrderConversionError(
          'INVALID_DRAFT',
          'Overridden line prices require an override reason'
        )
      }

      if (overrideAmount == null) {
        throw new DraftOrderConversionError(
          'INVALID_DRAFT',
          'Overridden line prices must use a non-negative override amount'
        )
      }

      finalPrice = overrideAmount
      overrideAuditEvents.push({
        title: normalizeText(item.title) || 'Line item',
        sku: normalizeText(item.sku) || undefined,
        reason: overrideReason,
        originalPrice,
        finalPrice,
      })
    }

    return {
      productId: item.productId || undefined,
      variantId: item.variantId || undefined,
      title: normalizeText(item.title) || 'Line item',
      variantTitle: normalizeText(item.variantTitle) || undefined,
      sku: normalizeText(item.sku) || undefined,
      quantity,
      priceCents: dollarsToCents(finalPrice),
    }
  })

  if (orderItems.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
    throw new DraftOrderConversionError('INVALID_DRAFT', 'Draft line item quantities must be positive integers')
  }

  try {
    const paymentStatus =
      String(input.paymentStatus || 'pending').toLowerCase() === 'paid' ? 'PAID' : 'PENDING'

    const order = await createOrder({
      customerId: input.customerId || undefined,
      email: normalizeText(input.email) || undefined,
      items: orderItems,
      paymentStatus,
      decrementInventory: paymentStatus === 'PAID',
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

    if (overrideAuditEvents.length) {
      const detail = overrideAuditEvents
        .map((entry) => {
          const skuPart = entry.sku ? ` (${entry.sku})` : ''
          return `${entry.title}${skuPart}: $${entry.originalPrice.toFixed(2)} -> $${entry.finalPrice.toFixed(2)}. Reason: ${entry.reason}`
        })
        .join(' | ')

      // TODO: add schema-backed override audit fields on OrderItem once the model supports them.
      await createOrderEvent(order.id, {
        type: 'DRAFT_LINE_PRICE_OVERRIDE_APPLIED',
        title: `Manual line price override applied (${overrideAuditEvents.length})`,
        detail,
        actorType: 'STAFF',
      })
    }

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
