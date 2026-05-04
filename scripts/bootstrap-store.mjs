import pkg from '@prisma/client';
const { PrismaClient, AddressType, EventActorType, FulfillmentStatus, OrderDisplayStatus, OrderFinancialStatus, OrderFulfillmentStatus, OrderSource, PaymentProvider, PaymentStatus, ProductStatus, UserRole, UserStatus } = pkg;
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DOOPIFY_ADMIN_EMAIL || 'owner@example.com';
  const password = process.env.DOOPIFY_ADMIN_PASSWORD || 'change-me-now';
  const passwordHash = await bcrypt.hash(password, 10);

  const store = await prisma.store.upsert({
    where: { id: 'doopify-demo-store' },
    update: {},
    create: {
      id: 'doopify-demo-store',
      name: process.env.DOOPIFY_STORE_NAME || 'Doopify Demo Store',
      supportEmail: email,
      orderPrefix: 'DPY',
      nextOrderSequence: 1006,
      shippingOrigin: 'Los Angeles warehouse',
    },
  });

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      storeId: store.id,
      email,
      firstName: 'Doopify',
      lastName: 'Owner',
      passwordHash,
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
    },
  });

  const customer = await prisma.customer.upsert({
    where: { storeId_email: { storeId: store.id, email: 'olivia@northfield.co' } },
    update: {},
    create: {
      storeId: store.id,
      email: 'olivia@northfield.co',
      firstName: 'Olivia',
      lastName: 'Carter',
      totalSpent: 429,
      orderCount: 1,
    },
  });

  const product = await prisma.product.upsert({
    where: { handle: 'lumix-pro-wireless' },
    update: {},
    create: {
      storeId: store.id,
      title: 'Lumix Pro Wireless',
      handle: 'lumix-pro-wireless',
      description: 'Demo product for order architecture bootstrap.',
      status: ProductStatus.ACTIVE,
      publishedAt: new Date(),
    },
  });

  const variant = await prisma.productVariant.upsert({
    where: { id: 'demo-variant-lumix-midnight' },
    update: {},
    create: {
      id: 'demo-variant-lumix-midnight',
      productId: product.id,
      title: 'Midnight',
      sku: 'LUMIX-MIDNIGHT',
      price: 299,
      inventoryQuantity: 24,
    },
  });

  const existingOrder = await prisma.order.findUnique({ where: { orderNumber: '1001' } });

  if (!existingOrder) {
    const order = await prisma.order.create({
      data: {
        storeId: store.id,
        customerId: customer.id,
        orderNumber: '1001',
        displayStatus: OrderDisplayStatus.OPEN,
        source: OrderSource.ONLINE_STORE,
        financialStatus: OrderFinancialStatus.PAID,
        fulfillmentStatus: OrderFulfillmentStatus.UNFULFILLED,
        currency: 'USD',
        customerEmail: customer.email,
        subtotalAmount: 429,
        shippingAmount: 8,
        taxAmount: 3.26,
        totalAmount: 440.26,
        placedAt: new Date(),
        tags: ['VIP', 'Priority'],
        note: 'Requested gift wrap on headphones.',
        items: {
          create: [
            {
              productId: product.id,
              variantId: variant.id,
              title: 'Lumix Pro Wireless',
              variantTitle: 'Midnight',
              sku: 'LUMIX-MIDNIGHT',
              quantity: 1,
              unitPrice: 299,
              lineTotal: 299,
            },
            {
              title: 'Velox Run Trainer',
              variantTitle: '10 / Flare Red',
              quantity: 1,
              unitPrice: 120,
              lineTotal: 120,
            },
            {
              title: 'Titan Care Plan',
              variantTitle: '1 Year',
              quantity: 1,
              unitPrice: 10,
              lineTotal: 10,
            },
          ],
        },
        addresses: {
          create: [
            {
              type: AddressType.SHIPPING,
              firstName: 'Olivia',
              lastName: 'Carter',
              address1: '4476 Santa Monica Blvd',
              city: 'Los Angeles',
              province: 'CA',
              postalCode: '90029',
              country: 'US',
            },
            {
              type: AddressType.BILLING,
              firstName: 'Olivia',
              lastName: 'Carter',
              address1: '4476 Santa Monica Blvd',
              city: 'Los Angeles',
              province: 'CA',
              postalCode: '90029',
              country: 'US',
            },
          ],
        },
        payments: {
          create: {
            storeId: store.id,
            provider: PaymentProvider.STRIPE,
            status: PaymentStatus.SUCCEEDED,
            amount: 440.26,
            currency: 'USD',
          },
        },
        fulfillments: {
          create: {
            status: FulfillmentStatus.PENDING,
            locationName: 'Los Angeles warehouse',
            carrier: 'UPS',
            service: 'UPS Ground',
          },
        },
        events: {
          create: [
            {
              actorType: EventActorType.SYSTEM,
              title: 'Order created',
              detail: 'Order was placed online.',
              eventType: 'order_created',
            },
            {
              actorType: EventActorType.SYSTEM,
              title: 'Payment captured',
              detail: 'Customer payment was authorized and captured.',
              eventType: 'payment_captured',
            },
          ],
        },
      },
    });

    console.log(`Bootstrapped order ${order.orderNumber}`);
  }

  console.log(`Bootstrap complete for store ${store.name}`);
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
