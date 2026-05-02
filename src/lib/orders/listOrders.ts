type OrderFilterOption = 'all' | string

type OrderListFilters<TOrder> = {
  view?: string
  search?: string
  payment?: OrderFilterOption
  fulfillment?: OrderFilterOption
  delivery?: OrderFilterOption
  getOrderViewMatch: (order: TOrder, view: string) => boolean
  searchOrder: (order: TOrder, search: string) => boolean
}

type FilterableOrder = {
  paymentStatus?: string
  fulfillmentStatus?: string
  deliveryStatus?: string
}

export function listOrders<TOrder extends FilterableOrder>(
  orders: readonly TOrder[],
  {
    view = 'all',
    search = '',
    payment = 'all',
    fulfillment = 'all',
    delivery = 'all',
    getOrderViewMatch,
    searchOrder,
  }: OrderListFilters<TOrder>,
): TOrder[] {
  return orders.filter((order) => {
    const baseMatch = getOrderViewMatch(order, view) && searchOrder(order, search)
    const paymentMatch = payment === 'all' || order.paymentStatus === payment
    const fulfillmentMatch = fulfillment === 'all' || order.fulfillmentStatus === fulfillment
    const deliveryMatch = delivery === 'all' || order.deliveryStatus === delivery
    return baseMatch && paymentMatch && fulfillmentMatch && deliveryMatch
  })
}
