import type { FulfillmentState, FulfillmentStatus } from '@prisma/client'

type OrderItemQuantity = {
  id: string
  quantity: number
}

type FulfillmentQuantityRow = {
  status: FulfillmentState | string
  deliveredAt?: Date | null
  items: Array<{
    orderItemId: string
    quantity: number
  }>
}

export type ShippingStatus =
  | 'NOT_SHIPPED'
  | 'PARTIALLY_SHIPPED'
  | 'SHIPPED'
  | 'DELIVERED'

const NON_ACTIVE_FULFILLMENT_STATES = new Set(['CANCELLED', 'ERROR', 'FAILURE'])

function isActiveFulfillmentState(status: FulfillmentState | string) {
  return !NON_ACTIVE_FULFILLMENT_STATES.has(String(status || '').toUpperCase())
}

function normalizeFulfilledQuantities(input: {
  orderItems: OrderItemQuantity[]
  fulfillmentRows: FulfillmentQuantityRow[]
}) {
  const fulfilledByOrderItemId = new Map<string, number>()

  for (const item of input.orderItems) {
    fulfilledByOrderItemId.set(item.id, 0)
  }

  for (const fulfillment of input.fulfillmentRows) {
    if (!isActiveFulfillmentState(fulfillment.status)) continue
    for (const item of fulfillment.items) {
      const current = fulfilledByOrderItemId.get(item.orderItemId) ?? 0
      fulfilledByOrderItemId.set(item.orderItemId, current + Number(item.quantity || 0))
    }
  }

  return fulfilledByOrderItemId
}

export function resolveFulfillmentStatusFromQuantities(input: {
  orderItems: OrderItemQuantity[]
  fulfilledByOrderItemId: Map<string, number>
}): FulfillmentStatus {
  const allUnfulfilled = input.orderItems.every(
    (item) => (input.fulfilledByOrderItemId.get(item.id) ?? 0) <= 0
  )
  if (allUnfulfilled) return 'UNFULFILLED'

  const allFulfilled = input.orderItems.every((item) => {
    const fulfilled = input.fulfilledByOrderItemId.get(item.id) ?? 0
    return fulfilled >= Number(item.quantity || 0)
  })
  if (allFulfilled) return 'FULFILLED'

  return 'PARTIALLY_FULFILLED'
}

export function resolveOrderFulfillmentSnapshot(input: {
  orderItems: OrderItemQuantity[]
  fulfillmentRows: FulfillmentQuantityRow[]
}) {
  const fulfilledByOrderItemId = normalizeFulfilledQuantities(input)
  const fulfillmentStatus = resolveFulfillmentStatusFromQuantities({
    orderItems: input.orderItems,
    fulfilledByOrderItemId,
  })

  const activeFulfillments = input.fulfillmentRows.filter((row) =>
    isActiveFulfillmentState(row.status)
  )
  const hasActiveFulfillments = activeFulfillments.length > 0
  const allDeliveriesMarkedDelivered =
    hasActiveFulfillments &&
    activeFulfillments.every((row) => Boolean(row.deliveredAt))

  const shippingStatus: ShippingStatus = allDeliveriesMarkedDelivered
    ? 'DELIVERED'
    : fulfillmentStatus === 'FULFILLED'
      ? 'SHIPPED'
      : fulfillmentStatus === 'PARTIALLY_FULFILLED'
        ? 'PARTIALLY_SHIPPED'
        : 'NOT_SHIPPED'

  return {
    fulfillmentStatus,
    shippingStatus,
    fulfilledByOrderItemId,
  }
}

export function shippingStatusToUiLabel(status: ShippingStatus) {
  switch (status) {
    case 'DELIVERED':
      return 'Delivered'
    case 'SHIPPED':
      return 'Shipped'
    case 'PARTIALLY_SHIPPED':
      return 'Partially shipped'
    case 'NOT_SHIPPED':
    default:
      return 'Not shipped'
  }
}

export function shippingStatusToFilterValue(status: ShippingStatus) {
  switch (status) {
    case 'DELIVERED':
      return 'delivered'
    case 'SHIPPED':
      return 'shipped'
    case 'PARTIALLY_SHIPPED':
      return 'partially shipped'
    case 'NOT_SHIPPED':
    default:
      return 'not shipped'
  }
}
