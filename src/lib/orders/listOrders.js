export function listOrders(orders, { view = 'all', search = '', payment = 'all', fulfillment = 'all', delivery = 'all', getOrderViewMatch, searchOrder }) {
  return orders.filter(order => {
    const baseMatch = getOrderViewMatch(order, view) && searchOrder(order, search);
    const paymentMatch = payment === 'all' || order.paymentStatus === payment;
    const fulfillmentMatch = fulfillment === 'all' || order.fulfillmentStatus === fulfillment;
    const deliveryMatch = delivery === 'all' || order.deliveryStatus === delivery;
    return baseMatch && paymentMatch && fulfillmentMatch && deliveryMatch;
  });
}
