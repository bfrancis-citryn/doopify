type DbOrderAddress = {
  type: 'SHIPPING' | 'BILLING' | string
  address1?: string | null
  city?: string | null
  province?: string | null
  postalCode?: string | null
  country?: string | null
}

type DbOrderFulfillment = {
  status?: string | null
  carrier?: string | null
  trackingNumber?: string | null
}

type DbOrderEvent = {
  id: string
  title: string
  detail?: string | null
  createdAt: Date
}

type DbOrderItem = {
  id: string
  title: string
  variantTitle?: string | null
  quantity: number
  unitPrice?: number | string | null
}

type DbOrderCustomer = {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}

export type DbOrderLike = {
  id: string
  orderNumber: string | number
  createdAt: Date
  customer?: DbOrderCustomer | null
  customerEmail?: string | null
  source?: string | null
  totalAmount?: number | string | null
  items?: DbOrderItem[] | null
  financialStatus?: string | null
  fulfillmentStatus?: string | null
  tags?: string[] | null
  note?: string | null
  addresses?: DbOrderAddress[] | null
  fulfillments?: DbOrderFulfillment[] | null
  events?: DbOrderEvent[] | null
}

export type OrderViewModel = {
  id: string
  orderNumber: string
  createdAt: Date
  customer: {
    name: string
    email: string
  }
  channel: string | null | undefined
  total: number
  itemCount: number
  paymentStatus: string
  fulfillmentStatus: string
  deliveryStatus: string
  tags: string[]
  carrier: string
  trackingNumber: string
  shippingAddress: string
  billingAddress: string
  notes: string
  lineItems: Array<{
    id: string
    title: string
    variant: string
    quantity: number
    price: number
  }>
  timeline: Array<{
    id: string
    event: string
    detail: string
    createdAt: Date
  }>
}

function formatAddress(address: DbOrderAddress | undefined): string {
  return address
    ? [address.address1, address.city, address.province, address.postalCode, address.country]
        .filter(Boolean)
        .join(', ')
    : ''
}

export function mapDbOrderToViewModel(order: DbOrderLike | null | undefined): OrderViewModel | null {
  if (!order) return null

  const shippingAddress = order.addresses?.find((address) => address.type === 'SHIPPING')
  const billingAddress = order.addresses?.find((address) => address.type === 'BILLING')
  const latestFulfillment = order.fulfillments?.[0] || null

  return {
    id: order.id,
    orderNumber: `#${order.orderNumber}`,
    createdAt: order.createdAt,
    customer: {
      name:
        [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') ||
        order.customerEmail ||
        'Guest customer',
      email: order.customer?.email || order.customerEmail || '',
    },
    channel: order.source,
    total: Number(order.totalAmount || 0),
    itemCount: order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
    paymentStatus: String(order.financialStatus || 'pending')
      .toLowerCase()
      .replace(/_/g, ' '),
    fulfillmentStatus: String(order.fulfillmentStatus || 'unfulfilled')
      .toLowerCase()
      .replace(/_/g, ' '),
    deliveryStatus: String(latestFulfillment?.status || 'not_shipped')
      .toLowerCase()
      .replace(/_/g, '-'),
    tags: order.tags || [],
    carrier: latestFulfillment?.carrier || 'Carrier pending',
    trackingNumber: latestFulfillment?.trackingNumber || '',
    shippingAddress: formatAddress(shippingAddress) || 'No shipping address',
    billingAddress: formatAddress(billingAddress) || 'No billing address',
    notes: order.note || '',
    lineItems: (order.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      variant: item.variantTitle || 'Default',
      quantity: item.quantity,
      price: Number(item.unitPrice || 0),
    })),
    timeline: (order.events || []).map((event) => ({
      id: event.id,
      event: event.title,
      detail: event.detail || '',
      createdAt: event.createdAt,
    })),
  }
}
