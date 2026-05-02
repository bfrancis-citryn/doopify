type OrderWithNumber = {
  orderNumber: string
}

export function getOrderByNumber<TOrder extends OrderWithNumber>(
  orders: readonly TOrder[],
  orderNumber: string | number,
): TOrder | null {
  const normalizedOrderNumber = `#${String(orderNumber).replace(/^#/, '')}`
  return orders.find((order) => order.orderNumber === normalizedOrderNumber) || null
}
