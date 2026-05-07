import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('./OrderAdjustmentsCard', () => ({
  default: () => <div>OrderAdjustmentsCardStub</div>,
}))

import OrderDetailView, { orderStatusChipTone } from './OrderDetailView'

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ord_1',
    orderNumber: '#1001',
    orderNumberValue: 1001,
    createdAt: '2026-04-30T12:00:00.000Z',
    sourceChannel: 'online',
    paymentStatusRaw: 'PAID',
    fulfillmentStatusRaw: 'UNFULFILLED',
    orderStatus: 'OPEN',
    currency: 'USD',
    subtotal: 50,
    shippingAmount: 10,
    shippingMethodName: 'Standard ground',
    taxAmount: 4,
    discountAmount: 5,
    total: 59,
    shippingCapabilities: {
      connectedProviders: [],
      labelProvider: null,
    },
    availableActions: {
      canBuyShippingLabel: true,
    },
    emailCapabilities: {
      hasCustomerEmail: true,
      providerConfigured: true,
    },
    discounts: [
      {
        id: 'disc_1',
        title: 'Spring sale',
        code: 'SPRING10',
        method: 'PERCENTAGE',
        amount: 5,
      },
    ],
    lineItems: [
      {
        id: 'item_1',
        title: 'Hoodie',
        variantTitle: 'Large',
        quantity: 2,
        total: 50,
        totalDiscount: 5,
      },
    ],
    fulfillments: [
      {
        id: 'ful_1',
        status: 'SUCCESS',
        carrier: 'UPS',
        service: 'Ground',
        trackingNumber: '1Z1001',
        trackingUrl: 'https://tracking.example.com/1Z1001',
      },
    ],
    shippingLabels: [],
    timeline: [
      {
        id: 'evt_1',
        event: 'Order placed',
        detail: 'Placed from checkout.',
        createdAt: '2026-04-30T12:00:00.000Z',
      },
    ],
    customer: {
      name: 'Sam Buyer',
      email: 'sam@example.com',
      phone: '555-1234',
    },
    notes: 'Gift wrap this order.',
    shippingSummary: {
      address: {
        firstName: 'Sam',
        lastName: 'Buyer',
        address1: '123 Main St',
        city: 'Los Angeles',
        province: 'CA',
        postalCode: '90001',
      },
    },
    billingAddress: {
      firstName: 'Sam',
      lastName: 'Buyer',
      address1: '400 Billing Ave',
      city: 'Los Angeles',
      province: 'CA',
      postalCode: '90001',
    },
    ...overrides,
  }
}

describe('OrderDetailView', () => {
  it('renders fulfillment method selector cards', () => {
    const html = renderToStaticMarkup(<OrderDetailView order={buildOrder()} />)

    expect(html).toContain('Fulfillment method')
    expect(html).toContain('Buy shipping label')
    expect(html).toContain('Add tracking manually')
  })

  it('shows only manual tracking workflow when no provider is connected', () => {
    const html = renderToStaticMarkup(
      <OrderDetailView
        order={buildOrder({
          shippingCapabilities: { connectedProviders: [], labelProvider: null },
        })}
      />
    )

    expect(html).toContain('Add tracking manually')
    expect(html).toContain('Save tracking')
    expect(html).not.toContain('Buy shipping label with Shippo')
    expect(html).not.toContain('Buy shipping label with EasyPost')
  })

  it('shows provider-specific buy-label workflow copy when provider is connected', () => {
    const html = renderToStaticMarkup(
      <OrderDetailView
        order={buildOrder({
          shippingCapabilities: { connectedProviders: ['SHIPPO'], labelProvider: 'SHIPPO' },
        })}
      />
    )

    expect(html).toContain('Buy shipping label with Shippo')
    expect(html).toContain('Get Shippo label rates')
    expect(html).toContain('Email tracking to customer')
    expect(html).not.toContain('Save tracking and email customer')
  })

  it('renders shipment card after manual tracking exists', () => {
    const html = renderToStaticMarkup(
      <OrderDetailView
        order={buildOrder({
          shippingLabels: [],
          fulfillments: [
            {
              id: 'ful_manual',
              status: 'SUCCESS',
              carrier: 'FedEx',
              service: 'Home Delivery',
              trackingNumber: 'FDX123',
              trackingUrl: 'https://fedex.example/FDX123',
            },
          ],
        })}
      />
    )

    expect(html).toContain('Shipment')
    expect(html).toContain('Tracking added manually')
    expect(html).toContain('Copy tracking')
    expect(html).toContain('View tracking')
  })

  it('renders shipment card with label details after label purchase', () => {
    const html = renderToStaticMarkup(
      <OrderDetailView
        order={buildOrder({
          fulfillments: [
            {
              id: 'ful_1',
              status: 'SUCCESS',
              carrier: 'USPS',
              service: 'Priority',
              trackingNumber: 'TRACK123',
              trackingUrl: 'https://track.example.com/TRACK123',
            },
          ],
          shippingLabels: [
            {
              id: 'label_1',
              fulfillmentId: 'ful_1',
              provider: 'SHIPPO',
              carrier: 'USPS',
              service: 'Priority',
              trackingNumber: 'TRACK123',
              trackingUrl: 'https://track.example.com/TRACK123',
              labelUrl: 'https://labels.example.com/label_1.pdf',
              labelAmount: 6,
              currency: 'USD',
            },
          ],
        })}
      />
    )

    expect(html).toContain('Label purchased')
    expect(html).toContain('Label cost: $6.00')
    expect(html).toContain('Print label')
  })

  it('labels payment summary shipping line as customer-paid shipping', () => {
    const html = renderToStaticMarkup(<OrderDetailView order={buildOrder()} />)
    expect(html).toContain('Shipping paid by customer')
  })

  it('renders toast viewport so action feedback is not top-banner-only', () => {
    const html = renderToStaticMarkup(<OrderDetailView order={buildOrder()} />)
    expect(html).toContain('toastViewport')
  })

  it('renders order shell sections', () => {
    const html = renderToStaticMarkup(<OrderDetailView order={buildOrder()} />)

    expect(html).toContain('#1001')
    expect(html).toContain('Line items')
    expect(html).toContain('Payment summary')
    expect(html).toContain('Timeline')
    expect(html).toContain('Customer')
    expect(html).toContain('Shipping address')
    expect(html).toContain('Billing address')
    expect(html).toContain('OrderAdjustmentsCardStub')
  })

  it('maps status chip tones correctly', () => {
    expect(orderStatusChipTone('PAID')).toBe('success')
    expect(orderStatusChipTone('UNFULFILLED')).toBe('warning')
    expect(orderStatusChipTone('FAILED')).toBe('danger')
    expect(orderStatusChipTone('UNKNOWN_STATE')).toBe('neutral')
  })
})
