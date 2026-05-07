export const ORDER_VIEWS = [
  { id: 'all', label: 'All' },
  { id: 'unfulfilled', label: 'Unfulfilled' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'open', label: 'Open' },
  { id: 'returns', label: 'Returns' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'local-pickup', label: 'Local pickup' },
];

export const ORDER_PAYMENT_STATUSES = ['paid', 'pending', 'refunded', 'partially refunded', 'failed'];
export const ORDER_FULFILLMENT_STATUSES = ['unfulfilled', 'not shipped', 'partially shipped', 'shipped', 'delivered'];
export const ORDER_DELIVERY_STATUSES = ['not shipped', 'partially shipped', 'shipped', 'delivered'];
export const ORDER_RETURN_STATUSES = ['none', 'requested', 'approved', 'received', 'refunded'];

function timeline(event, detail, createdAt) {
  return { id: `${event}-${detail}-${createdAt}`, event, detail, createdAt };
}

export function createSeedOrders() {
  return [
    {
      id: 'ord_1001',
      orderNumber: '#1001',
      createdAt: '2026-04-06T14:12:00Z',
      customer: { name: 'Olivia Carter', email: 'olivia@northfield.co' },
      channel: 'Online Store',
      total: 429.0,
      itemCount: 3,
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      deliveryStatus: 'not shipped',
      returnStatus: 'none',
      deliveryMethod: 'Standard shipping',
      tags: ['VIP', 'Priority'],
      riskLevel: 'low',
      trackingNumber: '',
      carrier: 'UPS',
      location: 'Los Angeles warehouse',
      shippingAddress: '4476 Santa Monica Blvd, Los Angeles, CA',
      billingAddress: '4476 Santa Monica Blvd, Los Angeles, CA',
      notes: 'Requested gift wrap on headphones.',
      timeline: [
        timeline('Order created', 'Order was placed online.', '2026-04-06T14:12:00Z'),
        timeline('Payment captured', 'Customer payment was authorized and captured.', '2026-04-06T14:13:00Z'),
      ],
      lineItems: [
        { id: 'li_1', title: 'Lumix Pro Wireless', variant: 'Midnight', quantity: 1, price: 299 },
        { id: 'li_2', title: 'Velox Run Trainer', variant: '10 / Flare Red', quantity: 1, price: 120 },
        { id: 'li_3', title: 'Titan Care Plan', variant: '1 Year', quantity: 1, price: 10 },
      ],
    },
    {
      id: 'ord_1002',
      orderNumber: '#1002',
      createdAt: '2026-04-06T12:48:00Z',
      customer: { name: 'Noah Bennett', email: 'noah@westgrid.io' },
      channel: 'Instagram',
      total: 349.0,
      itemCount: 1,
      paymentStatus: 'pending',
      fulfillmentStatus: 'not shipped',
      deliveryStatus: 'not shipped',
      returnStatus: 'none',
      deliveryMethod: 'Express shipping',
      tags: ['Fraud review'],
      riskLevel: 'medium',
      trackingNumber: '',
      carrier: 'FedEx',
      location: 'Los Angeles warehouse',
      shippingAddress: '9833 Grant Ave, Austin, TX',
      billingAddress: '9833 Grant Ave, Austin, TX',
      notes: 'Payment auth delayed; watch before packing.',
      timeline: [
        timeline('Order created', 'Order was imported from Instagram checkout.', '2026-04-06T12:48:00Z'),
        timeline('Risk flagged', 'Payment auth delayed; manual review recommended.', '2026-04-06T12:49:00Z'),
      ],
      lineItems: [{ id: 'li_4', title: 'Aether Chrono S1', variant: 'Leather / Black', quantity: 1, price: 349 }],
    },
    {
      id: 'ord_1003',
      orderNumber: '#1003',
      createdAt: '2026-04-05T21:05:00Z',
      customer: { name: 'Emma Diaz', email: 'emma@studiorye.com' },
      channel: 'POS',
      total: 120.0,
      itemCount: 1,
      paymentStatus: 'paid',
      fulfillmentStatus: 'shipped',
      deliveryStatus: 'delivered',
      returnStatus: 'none',
      deliveryMethod: 'Local pickup',
      tags: ['Pickup'],
      riskLevel: 'low',
      trackingNumber: 'PICKUP-1003',
      carrier: 'Pickup',
      location: 'Santa Barbara retail',
      shippingAddress: 'In-store pickup',
      billingAddress: '14 Canon Perdido St, Santa Barbara, CA',
      notes: 'Picked up same day.',
      timeline: [
        timeline('Order created', 'POS order placed in store.', '2026-04-05T21:05:00Z'),
        timeline('Ready for pickup', 'Order is ready at Santa Barbara retail.', '2026-04-05T21:15:00Z'),
        timeline('Picked up', 'Customer collected order in person.', '2026-04-05T21:42:00Z'),
      ],
      lineItems: [{ id: 'li_5', title: 'Velox Run Trainer', variant: '9 / Flare Red', quantity: 1, price: 120 }],
    },
    {
      id: 'ord_1004',
      orderNumber: '#1004',
      createdAt: '2026-04-05T18:27:00Z',
      customer: { name: 'Liam Foster', email: 'lfoster@northbeam.com' },
      channel: 'Online Store',
      total: 999.0,
      itemCount: 1,
      paymentStatus: 'paid',
      fulfillmentStatus: 'shipped',
      deliveryStatus: 'shipped',
      returnStatus: 'none',
      deliveryMethod: '2-day shipping',
      tags: ['Signature required'],
      riskLevel: 'low',
      trackingNumber: '1Z84X90Y0329912',
      carrier: 'UPS',
      location: 'Nevada warehouse',
      shippingAddress: '1600 Market St, San Francisco, CA',
      billingAddress: '1600 Market St, San Francisco, CA',
      notes: 'Leave at front desk after signature.',
      timeline: [
        timeline('Order created', 'Order was placed online.', '2026-04-05T18:27:00Z'),
        timeline('Packed', 'Packed at Nevada warehouse.', '2026-04-05T20:01:00Z'),
        timeline('Shipped', 'Tracking number added with UPS.', '2026-04-05T20:20:00Z'),
      ],
      lineItems: [{ id: 'li_6', title: 'Titan X-Phone', variant: '256 GB / Black', quantity: 1, price: 999 }],
    },
    {
      id: 'ord_1005',
      orderNumber: '#1005',
      createdAt: '2026-04-05T15:02:00Z',
      customer: { name: 'Sophia Nguyen', email: 'sophia@elmcollective.com' },
      channel: 'Online Store',
      total: 598.0,
      itemCount: 2,
      paymentStatus: 'partially refunded',
      fulfillmentStatus: 'returned',
      deliveryStatus: 'returned',
      returnStatus: 'received',
      deliveryMethod: 'Standard shipping',
      tags: ['Return'],
      riskLevel: 'low',
      trackingNumber: '9400110898822001005',
      carrier: 'USPS',
      location: 'Los Angeles warehouse',
      shippingAddress: '88 Mission Bay Blvd, San Diego, CA',
      billingAddress: '88 Mission Bay Blvd, San Diego, CA',
      notes: 'Customer returned one damaged item.',
      timeline: [
        timeline('Order created', 'Order was placed online.', '2026-04-05T15:02:00Z'),
        timeline('Delivered', 'Order delivered to customer.', '2026-04-06T09:20:00Z'),
        timeline('Return requested', 'Customer reported damaged item.', '2026-04-06T13:15:00Z'),
        timeline('Return received', 'Warehouse scanned returned parcel.', '2026-04-06T19:05:00Z'),
      ],
      lineItems: [
        { id: 'li_7', title: 'Lumix Pro Wireless', variant: 'Silver', quantity: 1, price: 299 },
        { id: 'li_8', title: 'Lumix Pro Wireless', variant: 'Midnight', quantity: 1, price: 299 },
      ],
    },
  ];
}

export function formatOrderMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export function getOrderViewMatch(order, viewId) {
  switch (viewId) {
    case 'unfulfilled':
      return ['unfulfilled', 'not shipped'].includes(order.fulfillmentStatus);
    case 'unpaid':
      return ['pending', 'failed'].includes(order.paymentStatus);
    case 'open':
      return !['delivered'].includes(order.deliveryStatus);
    case 'returns':
      return order.returnStatus !== 'none';
    case 'delivered':
      return order.deliveryStatus === 'delivered';
    case 'local-pickup':
      return order.deliveryMethod.toLowerCase().includes('pickup');
    case 'all':
    default:
      return true;
  }
}

export function searchOrder(order, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [
    order.orderNumber,
    order.customer.name,
    order.customer.email,
    order.channel,
    order.deliveryMethod,
    order.paymentStatus,
    order.fulfillmentStatus,
    order.deliveryStatus,
    order.returnStatus,
    ...(order.tags || []),
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery);
}

export function summarizeOrders(orders) {
  return {
    orders: orders.length,
    itemsOrdered: orders.reduce((sum, order) => sum + order.itemCount, 0),
    returns: orders.filter(order => order.returnStatus !== 'none').length,
    fulfilled: orders.filter(order => ['shipped', 'delivered', 'partially shipped', 'fulfilled'].includes(order.fulfillmentStatus)).length,
    delivered: orders.filter(order => order.deliveryStatus === 'delivered').length,
    toFulfill: orders.filter(order => ['unfulfilled', 'not shipped'].includes(order.fulfillmentStatus)).length,
  };
}
