import type { DbOrderLike, OrderViewModel } from './mapDbOrderToViewModel'
import { mapDbOrderToViewModel } from './mapDbOrderToViewModel'

type PrismaOrderQueries = {
  order: {
    findMany: (args: unknown) => Promise<DbOrderLike[]>
    findFirst: (args: unknown) => Promise<DbOrderLike | null>
  }
}

export async function listOrdersFromDb(
  prisma: PrismaOrderQueries,
  storeId: string,
): Promise<Array<OrderViewModel | null>> {
  const orders = await prisma.order.findMany({
    where: { storeId },
    orderBy: { createdAt: 'desc' },
    include: {
      customer: true,
      items: true,
      addresses: true,
      fulfillments: { orderBy: { createdAt: 'desc' } },
      events: { orderBy: { createdAt: 'desc' } },
    },
  })

  return orders.map(mapDbOrderToViewModel)
}

export async function getOrderByNumberFromDb(
  prisma: PrismaOrderQueries,
  storeId: string,
  orderNumber: string | number,
): Promise<OrderViewModel | null> {
  const normalized = String(orderNumber).replace(/^#/, '')

  const order = await prisma.order.findFirst({
    where: { storeId, orderNumber: normalized },
    include: {
      customer: true,
      items: true,
      addresses: true,
      fulfillments: { orderBy: { createdAt: 'desc' } },
      events: { orderBy: { createdAt: 'desc' } },
      payments: true,
      refunds: true,
      returns: { include: { items: true } },
    },
  })

  return mapDbOrderToViewModel(order)
}
