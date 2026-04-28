export type DoopifyEvents = {
  'order.created': {
    orderId: string
    orderNumber: number
    email?: string | null
    total: number
    currency: string
  }
  'order.paid': {
    orderId: string
    orderNumber: number
    email?: string | null
    total: number
    currency: string
    items: Array<{
      title: string
      variantTitle?: string | null
      quantity: number
      price: number
    }>
    shippingAddress?: {
      firstName?: string | null
      lastName?: string | null
      address1?: string | null
      city?: string | null
      province?: string | null
      postalCode?: string | null
      country?: string | null
    }
  }
  'product.created': {
    productId: string
    handle: string
    title: string
    status: string
  }
  'product.updated': {
    productId: string
    handle: string
    title: string
    status: string
  }
  'fulfillment.created': {
    fulfillmentId: string
    orderId: string
    trackingNumber?: string | null
  }
  'checkout.failed': {
    paymentIntentId: string
    email?: string | null
    reason?: string | null
  }
  'order.refunded': {
    orderId: string
    orderNumber: number
    refundId: string
    amount: number
    currency: string
  }
  'order.return_requested': {
    orderId: string
    orderNumber: number
    returnId: string
  }
  'order.return_updated': {
    orderId: string
    orderNumber: number
    returnId: string
    status: string
  }
}

export type DoopifyEventName = keyof DoopifyEvents

export type InternalEventHandler<K extends DoopifyEventName = DoopifyEventName> = {
  event: K
  handle: (payload: DoopifyEvents[K]) => Promise<void> | void
}

export type AnyInternalEventHandler = {
  [K in DoopifyEventName]: InternalEventHandler<K>
}[DoopifyEventName]
