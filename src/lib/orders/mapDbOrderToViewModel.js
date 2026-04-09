export function mapDbOrderToViewModel(order) {
  if (!order) return null;

  const shippingAddress = order.addresses?.find(address => address.type === 'SHIPPING');
  const billingAddress = order.addresses?.find(address => address.type === 'BILLING');
  const latestFulfillment = order.fulfillments?.[0] || null;

  return {
    id: order.id,
    orderNumber: `#${order.orderNumber}`,
    createdAt: order.createdAt,
    customer: {
      name: [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') || order.customerEmail || 'Guest customer',
      email: order.customer?.email || order.customerEmail || '',
    },
    channel: order.source,
    total: Number(order.totalAmount || 0),
    itemCount: order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
    paymentStatus: String(order.financialStatus || 'pending').toLowerCase().replace(/_/g, ' '),
    fulfillmentStatus: String(order.fulfillmentStatus || 'unfulfilled').toLowerCase().replace(/_/g, ' '),
    deliveryStatus: String(latestFulfillment?.status || 'not_shipped').toLowerCase().replace(/_/g, '-'),
    tags: order.tags || [],
    carrier: latestFulfillment?.carrier || 'Carrier pending',
    trackingNumber: latestFulfillment?.trackingNumber || '',
    shippingAddress: shippingAddress ? [shippingAddress.address1, shippingAddress.city, shippingAddress.province, shippingAddress.postalCode, shippingAddress.country].filter(Boolean).join(', ') : 'No shipping address',
    billingAddress: billingAddress ? [billingAddress.address1, billingAddress.city, billingAddress.province, billingAddress.postalCode, billingAddress.country].filter(Boolean).join(', ') : 'No billing address',
    notes: order.note || '',
    lineItems: (order.items || []).map(item => ({
      id: item.id,
      title: item.title,
      variant: item.variantTitle || 'Default',
      quantity: item.quantity,
      price: Number(item.unitPrice || 0),
    })),
    timeline: (order.events || []).map(event => ({
      id: event.id,
      event: event.title,
      detail: event.detail || '',
      createdAt: event.createdAt,
    })),
  };
}
