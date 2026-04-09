import { mapDbOrderToViewModel } from './mapDbOrderToViewModel';

export async function listOrdersFromDb(prisma, storeId) {
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
  });

  return orders.map(mapDbOrderToViewModel);
}

export async function getOrderByNumberFromDb(prisma, storeId, orderNumber) {
  const normalized = String(orderNumber).replace(/^#/, '');

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
  });

  return mapDbOrderToViewModel(order);
}
