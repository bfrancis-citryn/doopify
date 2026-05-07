function toHumanLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ');
}

function centsToDollars(valueCents) {
  const numberValue = Number(valueCents);
  if (!Number.isFinite(numberValue)) return 0;
  return numberValue / 100;
}

function resolveMoney(order, dollarsKey, centsKey) {
  if (typeof order[dollarsKey] === 'number') return order[dollarsKey];
  if (typeof order[centsKey] === 'number') return centsToDollars(order[centsKey]);
  return 0;
}

function resolveShippingStatusLabel(order) {
  const raw =
    order.shippingStatusDerived ||
    order.shippingStatusRaw ||
    order.fulfillmentStatusDerived ||
    order.fulfillmentStatus ||
    'UNFULFILLED';
  const normalized = String(raw).toUpperCase();

  if (normalized === 'DELIVERED') return 'delivered';
  if (normalized === 'SHIPPED' || normalized === 'FULFILLED') return 'shipped';
  if (normalized === 'PARTIALLY_SHIPPED' || normalized === 'PARTIALLY_FULFILLED') {
    return 'partially shipped';
  }
  return 'not shipped';
}

export function transformOrder(order) {
  const shippingAddress = order.addresses?.find((entry) => entry.type === 'SHIPPING');
  const billingAddress = order.addresses?.find((entry) => entry.type === 'BILLING');
  const shippingAddressText = shippingAddress
    ? [shippingAddress.address1, shippingAddress.city, shippingAddress.province]
        .filter(Boolean)
        .join(', ')
    : '';
  const billingAddressText = billingAddress
    ? [billingAddress.address1, billingAddress.city, billingAddress.province]
        .filter(Boolean)
        .join(', ')
    : shippingAddressText;

  const customerName = order.customer
    ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') ||
      order.customer.email
    : order.email || 'Guest';

  const paymentStatus = toHumanLabel(order.paymentStatus || 'PENDING');
  const shippingStatus = resolveShippingStatusLabel(order);
  const fulfillmentStatus = shippingStatus === 'not shipped' ? 'unfulfilled' : shippingStatus;

  return {
    id: order.id,
    orderNumber: `#${order.orderNumber}`,
    createdAt: order.createdAt,
    customer: {
      name: customerName,
      email: order.customer?.email || order.email || '',
    },
    channel: order.channel || 'Online Store',
    total: resolveMoney(order, 'total', 'totalCents'),
    itemCount:
      Array.isArray(order.items) && order.items.length
        ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
        : 0,
    paymentStatus,
    fulfillmentStatus,
    deliveryStatus: shippingStatus,
    returnStatus: order.returns?.length > 0 ? toHumanLabel(order.returns[0].status) : 'none',
    deliveryMethod: resolveMoney(order, 'shippingAmount', 'shippingAmountCents') > 0 ? 'Shipping' : 'Free shipping',
    tags: order.tags || [],
    riskLevel: 'low',
    trackingNumber: order.fulfillments?.[0]?.trackingNumber || '',
    carrier: order.fulfillments?.[0]?.carrier || '',
    location: '',
    shippingAddress: shippingAddressText,
    billingAddress: billingAddressText,
    notes: order.note || '',
    timeline: (order.events || []).map((event) => ({
      id: event.id,
      event: event.title,
      detail: event.detail || '',
      createdAt: event.createdAt,
    })),
    lineItems: (order.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      variant: item.variantTitle || '',
      quantity: item.quantity,
      price:
        typeof item.price === 'number'
          ? item.price
          : typeof item.priceCents === 'number'
            ? centsToDollars(item.priceCents)
            : 0,
    })),
    subtotal: resolveMoney(order, 'subtotal', 'subtotalCents'),
    taxAmount: resolveMoney(order, 'taxAmount', 'taxAmountCents'),
    shippingAmount: resolveMoney(order, 'shippingAmount', 'shippingAmountCents'),
    discountAmount: resolveMoney(order, 'discountAmount', 'discountAmountCents'),
    currency: order.currency || 'USD',
    status: toHumanLabel(order.status || 'OPEN'),
  };
}
