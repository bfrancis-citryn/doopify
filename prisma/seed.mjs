// Doopify — Database Seed Script
// Run with: npm run db:seed

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Doopify database...')

  // ── Store ──────────────────────────────────────────────────────────────────
  const store = await prisma.store.upsert({
    where: { domain: 'doopify.local' },
    update: {},
    create: {
      name: 'Doopify Store',
      email: 'hello@doopify.com',
      domain: 'doopify.local',
      currency: 'USD',
      timezone: 'America/New_York',
      primaryColor: '#0f172a',
      secondaryColor: '#22c55e',
    },
  })
  console.log(`✅ Store: ${store.name}`)

  // ── Admin user ─────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@doopify.com' },
    update: {},
    create: {
      email: 'admin@doopify.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'OWNER',
      isActive: true,
    },
  })
  console.log(`✅ Admin user: ${admin.email} / password: admin123`)

  // ── Products ───────────────────────────────────────────────────────────────
  const productData = [
    {
      title: 'Classic White Tee',
      handle: 'classic-white-tee',
      vendor: 'Doopify Basics',
      description: 'A timeless white tee made from 100% organic cotton. Soft, breathable, and built to last.',
      tags: ['apparel', 'basics', 'cotton'],
      variants: [
        { title: 'S', sku: 'CWT-S', price: 29.99, inventory: 50 },
        { title: 'M', sku: 'CWT-M', price: 29.99, inventory: 75 },
        { title: 'L', sku: 'CWT-L', price: 29.99, inventory: 60 },
        { title: 'XL', sku: 'CWT-XL', price: 29.99, inventory: 30 },
      ],
    },
    {
      title: 'Merino Wool Sweater',
      handle: 'merino-wool-sweater',
      vendor: 'Doopify Basics',
      description: 'Premium merino wool sweater. Warm without the bulk, perfect for layering.',
      tags: ['apparel', 'winter', 'wool'],
      variants: [
        { title: 'S / Navy', sku: 'MWS-S-NVY', price: 89.99, inventory: 20 },
        { title: 'M / Navy', sku: 'MWS-M-NVY', price: 89.99, inventory: 35 },
        { title: 'L / Navy', sku: 'MWS-L-NVY', price: 89.99, inventory: 25 },
        { title: 'S / Grey', sku: 'MWS-S-GRY', price: 89.99, inventory: 18 },
        { title: 'M / Grey', sku: 'MWS-M-GRY', price: 89.99, inventory: 30 },
      ],
    },
    {
      title: 'Leather Crossbody Bag',
      handle: 'leather-crossbody-bag',
      vendor: 'Doopify Goods',
      description: 'Full-grain leather crossbody bag. Compact, elegant, and durable.',
      tags: ['accessories', 'leather', 'bags'],
      variants: [
        { title: 'Tan', sku: 'LCB-TAN', price: 149.99, inventory: 15 },
        { title: 'Black', sku: 'LCB-BLK', price: 149.99, inventory: 22 },
        { title: 'Brown', sku: 'LCB-BRN', price: 149.99, inventory: 12 },
      ],
    },
    {
      title: 'Ceramic Pour-Over Set',
      handle: 'ceramic-pour-over-set',
      vendor: 'Doopify Home',
      description: 'Handcrafted ceramic pour-over coffee set. Includes dripper and carafe.',
      tags: ['home', 'coffee', 'ceramic'],
      variants: [
        { title: 'White', sku: 'CPO-WHT', price: 65.00, inventory: 40 },
        { title: 'Matte Black', sku: 'CPO-BLK', price: 65.00, inventory: 28 },
      ],
    },
    {
      title: 'Linen Throw Pillow',
      handle: 'linen-throw-pillow',
      vendor: 'Doopify Home',
      description: 'Belgian linen throw pillow. Adds texture and warmth to any space.',
      tags: ['home', 'linen', 'decor'],
      variants: [
        { title: '18" x 18" / Natural', sku: 'LTP-18-NAT', price: 45.00, inventory: 55 },
        { title: '18" x 18" / Sage', sku: 'LTP-18-SGE', price: 45.00, inventory: 38 },
        { title: '22" x 22" / Natural', sku: 'LTP-22-NAT', price: 55.00, inventory: 30 },
      ],
    },
    {
      title: 'Running Shorts',
      handle: 'running-shorts',
      vendor: 'Doopify Active',
      description: '5-inch inseam running shorts with built-in liner. Lightweight and fast-drying.',
      tags: ['apparel', 'activewear', 'running'],
      variants: [
        { title: 'S / Black', sku: 'RS-S-BLK', price: 55.00, inventory: 45 },
        { title: 'M / Black', sku: 'RS-M-BLK', price: 55.00, inventory: 60 },
        { title: 'L / Black', sku: 'RS-L-BLK', price: 55.00, inventory: 40 },
        { title: 'S / Navy', sku: 'RS-S-NVY', price: 55.00, inventory: 30 },
        { title: 'M / Navy', sku: 'RS-M-NVY', price: 55.00, inventory: 42 },
      ],
    },
    {
      title: 'Bamboo Water Bottle',
      handle: 'bamboo-water-bottle',
      vendor: 'Doopify Active',
      description: 'Stainless steel bottle with bamboo cap. Keeps drinks cold 24hr, hot 12hr.',
      tags: ['accessories', 'eco', 'hydration'],
      variants: [
        { title: '500ml / White', sku: 'BWB-5-WHT', price: 38.00, inventory: 80 },
        { title: '500ml / Black', sku: 'BWB-5-BLK', price: 38.00, inventory: 70 },
        { title: '750ml / White', sku: 'BWB-7-WHT', price: 44.00, inventory: 50 },
        { title: '750ml / Black', sku: 'BWB-7-BLK', price: 44.00, inventory: 45 },
      ],
    },
    {
      title: 'Scented Soy Candle',
      handle: 'scented-soy-candle',
      vendor: 'Doopify Home',
      description: 'Hand-poured soy wax candle with wooden wick. 60-hour burn time.',
      tags: ['home', 'candles', 'wellness'],
      variants: [
        { title: 'Cedar & Smoke', sku: 'SSC-CED', price: 32.00, inventory: 60 },
        { title: 'Bergamot & Sage', sku: 'SSC-BRG', price: 32.00, inventory: 55 },
        { title: 'Vanilla & Sandalwood', sku: 'SSC-VAN', price: 32.00, inventory: 48 },
      ],
    },
    {
      title: 'Slim Fit Chinos',
      handle: 'slim-fit-chinos',
      vendor: 'Doopify Basics',
      description: 'Stretch cotton chinos with a modern slim fit. Dress up or down.',
      tags: ['apparel', 'bottoms', 'chinos'],
      variants: [
        { title: '30x30 / Khaki', sku: 'SFC-3030-KHK', price: 79.99, inventory: 25 },
        { title: '32x30 / Khaki', sku: 'SFC-3230-KHK', price: 79.99, inventory: 30 },
        { title: '34x30 / Khaki', sku: 'SFC-3430-KHK', price: 79.99, inventory: 20 },
        { title: '30x30 / Navy', sku: 'SFC-3030-NVY', price: 79.99, inventory: 22 },
        { title: '32x30 / Navy', sku: 'SFC-3230-NVY', price: 79.99, inventory: 28 },
      ],
    },
    {
      title: 'Wireless Charging Pad',
      handle: 'wireless-charging-pad',
      vendor: 'Doopify Tech',
      description: '15W fast wireless charger. Compatible with all Qi-enabled devices.',
      tags: ['tech', 'accessories', 'charging'],
      variants: [
        { title: 'White', sku: 'WCP-WHT', price: 49.99, inventory: 90 },
        { title: 'Black', sku: 'WCP-BLK', price: 49.99, inventory: 85 },
      ],
    },
  ]

  let productCount = 0
  const createdProducts = []

  for (const p of productData) {
    // Check if product already exists
    const existing = await prisma.product.findUnique({ where: { handle: p.handle } })
    if (existing) {
      createdProducts.push(existing)
      continue
    }

    const product = await prisma.product.create({
      data: {
        title: p.title,
        handle: p.handle,
        status: 'ACTIVE',
        description: p.description,
        vendor: p.vendor,
        tags: p.tags,
        variants: {
          create: p.variants.map((v, i) => ({
            title: v.title,
            sku: v.sku,
            price: v.price,
            inventory: v.inventory,
            position: i,
          })),
        },
      },
      include: { variants: true },
    })

    createdProducts.push(product)
    productCount++
  }

  console.log(`✅ Products: ${productCount} created (${productData.length - productCount} already existed)`)

  // ── Collections ────────────────────────────────────────────────────────────
  const collections = [
    { title: 'Apparel', handle: 'apparel' },
    { title: 'Home & Living', handle: 'home-living' },
    { title: 'Accessories', handle: 'accessories' },
    { title: 'Active', handle: 'active' },
  ]

  for (const c of collections) {
    await prisma.collection.upsert({
      where: { handle: c.handle },
      update: {},
      create: { title: c.title, handle: c.handle },
    })
  }
  console.log(`✅ Collections: ${collections.length} upserted`)

  // ── Customers ──────────────────────────────────────────────────────────────
  const customers = [
    { email: 'alex.johnson@example.com', firstName: 'Alex', lastName: 'Johnson', phone: '+1 555-0101' },
    { email: 'maria.chen@example.com', firstName: 'Maria', lastName: 'Chen', phone: '+1 555-0102' },
    { email: 'james.wilson@example.com', firstName: 'James', lastName: 'Wilson', phone: '+1 555-0103' },
    { email: 'sarah.davis@example.com', firstName: 'Sarah', lastName: 'Davis', phone: '+1 555-0104' },
    { email: 'michael.brown@example.com', firstName: 'Michael', lastName: 'Brown', phone: '+1 555-0105' },
  ]

  const createdCustomers = []
  let customerCount = 0

  for (const c of customers) {
    const existing = await prisma.customer.findUnique({ where: { email: c.email } })
    if (existing) {
      createdCustomers.push(existing)
      continue
    }

    const customer = await prisma.customer.create({
      data: {
        ...c,
        tags: ['vip'],
        addresses: {
          create: {
            firstName: c.firstName,
            lastName: c.lastName,
            address1: '123 Main St',
            city: 'New York',
            province: 'NY',
            postalCode: '10001',
            country: 'US',
            isDefault: true,
          },
        },
      },
    })
    createdCustomers.push(customer)
    customerCount++
  }

  console.log(`✅ Customers: ${customerCount} created`)

  // ── Sample Orders ──────────────────────────────────────────────────────────
  const orderStatuses = ['PAID', 'PAID', 'PAID', 'PENDING', 'REFUNDED']
  const fulfillmentStatuses = ['FULFILLED', 'UNFULFILLED', 'FULFILLED', 'UNFULFILLED', 'RESTOCKED']

  let orderCount = 0

  for (let i = 0; i < Math.min(5, createdCustomers.length); i++) {
    const customer = createdCustomers[i]
    const product = createdProducts[i % createdProducts.length]
    const variant = product.variants?.[0]

    if (!variant) continue

    // Check if this customer already has an order
    const existingOrder = await prisma.order.findFirst({
      where: { customerId: customer.id },
    })
    if (existingOrder) continue

    const subtotal = variant.price * 2
    const tax = parseFloat((subtotal * 0.08).toFixed(2))
    const total = parseFloat((subtotal + tax + 9.99).toFixed(2))

    await prisma.order.create({
      data: {
        customerId: customer.id,
        email: customer.email,
        status: 'OPEN',
        paymentStatus: orderStatuses[i],
        fulfillmentStatus: fulfillmentStatuses[i],
        subtotal,
        taxAmount: tax,
        shippingAmount: 9.99,
        total,
        items: {
          create: {
            productId: product.id,
            variantId: variant.id,
            title: product.title,
            variantTitle: variant.title,
            sku: variant.sku,
            price: variant.price,
            quantity: 2,
            total: subtotal,
          },
        },
        addresses: {
          create: {
            type: 'SHIPPING',
            firstName: customer.firstName,
            lastName: customer.lastName,
            address1: '123 Main St',
            city: 'New York',
            province: 'NY',
            postalCode: '10001',
            country: 'US',
          },
        },
        payments: {
          create: {
            provider: 'stripe',
            amount: total,
            currency: 'USD',
            status: orderStatuses[i],
          },
        },
        events: {
          create: {
            type: 'ORDER_PLACED',
            title: 'Order placed',
            detail: 'Order was created via online checkout',
            actorType: 'SYSTEM',
          },
        },
      },
    })

    // Update customer totals
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        orderCount: { increment: 1 },
        totalSpent: { increment: total },
      },
    })

    orderCount++
  }

  console.log(`✅ Orders: ${orderCount} created`)

  // ── Discounts ──────────────────────────────────────────────────────────────
  const discountExists = await prisma.discount.findUnique({ where: { code: 'LAUNCH10' } })
  if (!discountExists) {
    await prisma.discount.create({
      data: {
        code: 'LAUNCH10',
        title: '10% off launch discount',
        type: 'CODE',
        method: 'PERCENTAGE',
        value: 10,
        minimumOrder: 50,
        status: 'ACTIVE',
      },
    })
    await prisma.discount.create({
      data: {
        code: 'FREESHIP',
        title: 'Free shipping',
        type: 'CODE',
        method: 'FREE_SHIPPING',
        value: 0,
        status: 'ACTIVE',
      },
    })
  }
  console.log('✅ Discounts seeded')

  console.log('\n✨ Seed complete!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔑 Admin login:')
  console.log('   Email:    admin@doopify.com')
  console.log('   Password: admin123')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
