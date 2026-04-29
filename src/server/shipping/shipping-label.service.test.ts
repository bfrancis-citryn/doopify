import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    shippingLabel: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    fulfillment: {
      create: vi.fn(),
    },
    orderEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  getStoreSettings: vi.fn(),
  getShippingProviderConnectionStatus: vi.fn(),
  getShippingProviderApiKey: vi.fn(),
  getShippingProviderLiveRates: vi.fn(),
  purchaseShippingProviderLabel: vi.fn(),
  emitInternalEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/server/services/settings.service', () => ({
  getStoreSettings: mocks.getStoreSettings,
}))

vi.mock('@/server/shipping/shipping-provider.service', () => ({
  getShippingProviderConnectionStatus: mocks.getShippingProviderConnectionStatus,
  getShippingProviderApiKey: mocks.getShippingProviderApiKey,
  getShippingProviderLiveRates: mocks.getShippingProviderLiveRates,
  purchaseShippingProviderLabel: mocks.purchaseShippingProviderLabel,
}))

vi.mock('@/server/events/dispatcher', () => ({
  emitInternalEvent: mocks.emitInternalEvent,
}))

import { buyOrderShippingLabel } from './shipping-label.service'

const baseOrder = {
  id: 'order_1',
  orderNumber: 1001,
  paymentStatus: 'PAID',
  subtotalCents: 5000,
  shippingAmountCents: 999,
  taxAmountCents: 0,
  discountAmountCents: 0,
  totalCents: 5999,
  items: [
    { id: 'oi_1', variantId: 'var_1', quantity: 1, priceCents: 5000 },
    { id: 'oi_2', variantId: 'var_2', quantity: 1, priceCents: 3000 },
  ],
  addresses: [
    {
      type: 'SHIPPING',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '555-111-2222',
      address1: '1 Compute Way',
      address2: null,
      city: 'London',
      province: 'LN',
      postalCode: 'N1 1AA',
      country: 'GB',
    },
  ],
  fulfillments: [],
}

const baseStore = {
  id: 'store_1',
  currency: 'USD',
  shippingLiveProvider: 'EASYPOST',
  shippingOriginName: 'Doopify Warehouse',
  shippingOriginPhone: '555-000-0000',
  shippingOriginAddress1: '10 Origin St',
  shippingOriginAddress2: null,
  shippingOriginCity: 'Austin',
  shippingOriginProvince: 'TX',
  shippingOriginPostalCode: '78701',
  shippingOriginCountry: 'US',
  defaultLabelFormat: 'PDF',
  defaultLabelSize: '4x6',
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.prisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mocks.prisma) => Promise<unknown>) => fn(mocks.prisma)
  )

  mocks.getStoreSettings.mockResolvedValue(baseStore)
  mocks.getShippingProviderConnectionStatus.mockResolvedValue({
    provider: 'EASYPOST',
    connected: true,
  })
  mocks.getShippingProviderApiKey.mockResolvedValue('ep_test_key')
  mocks.getShippingProviderLiveRates.mockResolvedValue([
    {
      id: 'rate_1',
      source: 'EASYPOST',
      displayName: 'USPS Priority',
      amountCents: 642,
      currency: 'USD',
      providerRateId: 'rate_1',
      metadata: { shipmentId: 'shp_1' },
    },
  ])
  mocks.prisma.shippingLabel.findFirst.mockResolvedValue(null)
  mocks.prisma.fulfillment.create.mockResolvedValue({
    id: 'ful_1',
    trackingNumber: 'TRACK123',
    items: [{ id: 'fi_1', orderItemId: 'oi_1', quantity: 1 }],
  })
  mocks.prisma.shippingLabel.create.mockResolvedValue({
    id: 'label_1',
    orderId: 'order_1',
    providerRateId: 'rate_1',
    labelUrl: 'https://labels.example.com/label_1.pdf',
  })
  mocks.prisma.order.update.mockResolvedValue({})
  mocks.prisma.orderEvent.create.mockResolvedValue({})
  mocks.emitInternalEvent.mockResolvedValue(undefined)
})

describe('buyOrderShippingLabel', () => {
  it('creates ShippingLabel and fulfillment without mutating order totals', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(baseOrder)
    mocks.purchaseShippingProviderLabel.mockResolvedValue({
      providerShipmentId: 'shp_1',
      providerRateId: 'rate_1',
      providerLabelId: 'pl_1',
      carrier: 'USPS',
      service: 'Priority',
      status: 'PURCHASED',
      labelUrl: 'https://labels.example.com/label_1.pdf',
      trackingNumber: 'TRACK123',
      trackingUrl: 'https://track.example.com/TRACK123',
      labelAmountCents: 642,
      currency: 'USD',
      rawResponse: { ok: true },
    })

    const result = await buyOrderShippingLabel({
      orderNumber: 1001,
      items: [{ orderItemId: 'oi_1', quantity: 1 }],
      parcel: { weightOz: 12, lengthIn: 10, widthIn: 8, heightIn: 4 },
      providerRateId: 'rate_1',
      labelFormat: 'PDF',
      labelSize: '4x6',
    })

    expect(mocks.prisma.shippingLabel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order_1',
          provider: 'EASYPOST',
          providerRateId: 'rate_1',
          labelAmountCents: 642,
        }),
      })
    )
    expect(mocks.prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order_1' },
        data: { fulfillmentStatus: 'PARTIALLY_FULFILLED' },
      })
    )
    expect(mocks.prisma.order.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalCents: expect.anything(),
        }),
      })
    )
    expect(result).toMatchObject({
      duplicate: false,
      shippingLabel: { id: 'label_1' },
      fulfillment: { id: 'ful_1' },
    })
  })

  it('rejects label purchase for unpaid orders', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue({
      ...baseOrder,
      paymentStatus: 'PENDING',
    })

    await expect(
      buyOrderShippingLabel({
        orderNumber: 1001,
        items: [{ orderItemId: 'oi_1', quantity: 1 }],
        parcel: { weightOz: 12, lengthIn: 10, widthIn: 8, heightIn: 4 },
        providerRateId: 'rate_1',
      })
    ).rejects.toThrow('Labels can only be purchased for paid orders')
  })

  it('does not persist fulfillment/order mutations when provider label purchase fails', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(baseOrder)
    mocks.purchaseShippingProviderLabel.mockRejectedValue(new Error('Provider outage'))

    await expect(
      buyOrderShippingLabel({
        orderNumber: 1001,
        items: [{ orderItemId: 'oi_1', quantity: 1 }],
        parcel: { weightOz: 12, lengthIn: 10, widthIn: 8, heightIn: 4 },
        providerRateId: 'rate_1',
      })
    ).rejects.toThrow('Provider outage')

    expect(mocks.prisma.fulfillment.create).not.toHaveBeenCalled()
    expect(mocks.prisma.shippingLabel.create).not.toHaveBeenCalled()
    expect(mocks.prisma.order.update).not.toHaveBeenCalled()
  })

  it('returns existing shipping label on retry instead of buying a duplicate label', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(baseOrder)
    mocks.prisma.shippingLabel.findFirst.mockResolvedValue({
      id: 'label_existing',
      orderId: 'order_1',
      providerRateId: 'rate_1',
      status: 'PURCHASED',
      fulfillment: { id: 'ful_existing', items: [] },
    })

    const result = await buyOrderShippingLabel({
      orderNumber: 1001,
      items: [{ orderItemId: 'oi_1', quantity: 1 }],
      parcel: { weightOz: 12, lengthIn: 10, widthIn: 8, heightIn: 4 },
      providerRateId: 'rate_1',
    })

    expect(mocks.purchaseShippingProviderLabel).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      duplicate: true,
      shippingLabel: { id: 'label_existing' },
    })
  })
})

