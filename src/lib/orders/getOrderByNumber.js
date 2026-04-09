export function getOrderByNumber(orders, orderNumber) {
  const normalizedOrderNumber = `#${String(orderNumber).replace(/^#/, '')}`;
  return orders.find(order => order.orderNumber === normalizedOrderNumber) || null;
}
