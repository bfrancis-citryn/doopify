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
    createdAt: '2026-04-30T12:00:00.000Z',
    sourceChannel: 'online',
    paymentStatusRaw: 'PAID',
    fulfillmentStatusRaw: 'UNFULFILLED',
    orderStatus: 'OPEN',
    currency: 'USD',
    subtotal: 50,
    shippingAmount: 9.99,
    shippingMethodName: 'Standard ground',
    taxAmount: 4,
    discountAmount: 5,
    total: 58.99,
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
      },
    ],
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
  it('renders all required section headings', () => {
    const html = renderToStaticMarkup(<OrderDetailView order={buildOrder()} />)

    expect(html).toContain('#1001')
    expect(html).toContain('Fulfillment')
    expect(html).toContain('Create fulfillment')
    expect(html).toContain('Line items')
    expect(html).toContain('Payment summary')
    expect(html).toContain('Discounts')
    expect(html).toContain('Spring sale')
    expect(html).toContain('Timeline')
    expect(html).toContain('Customer')
    expect(html).toContain('Shipping address')
    expect(html).toContain('Billing address')
    expect(html).toContain('OrderAdjustmentsCardStub')
  })

  it('renders payment summary with shipping method, subtotal, tax, and total', () => {
    const html = renderToStaticMarkup(<OrderDetailView order={buildOrder()} />)

    expect(html).toContain('Payment summary')
    expect(html).toContain('Subtotal')
    expect(html).toContain('Shipping')
    expect(html).toContain('Standard ground')
    expect(html).toContain('Tax')
    expect(html).toContain('Total')
  })

  it('renders labeled status chips for payment, fulfillment, and order', () => {
    const html = renderToStaticMarkup(<OrderDetailView order={buildOrder()} />)

    expect(html).toContain('Payment')
    expect(html).toContain('PAID')
    expect(html).toContain('UNFULFILLED')
    expect(html).toContain('OPEN')
  })

  it('renders intentional empty states when no data exists in any section', () => {
    const html = renderToStaticMarkup(
      <OrderDetailView
        order={buildOrder({
          lineItems: [],
          fulfillments: [],
          timeline: [],
          notes: '',
          discounts: [],
        })}
      />
    )

    expect(html).toContain('No fulfillment records')
    expect(html).toContain('No line items')
    expect(html).toContain('No timeline events')
    expect(html).toContain('No notes')
    expect(html).toContain('No discounts')
  })

  it('maps status chip tones correctly', () => {
    expect(orderStatusChipTone('PAID')).toBe('success')
    expect(orderStatusChipTone('UNFULFILLED')).toBe('warning')
    expect(orderStatusChipTone('FAILED')).toBe('danger')
    expect(orderStatusChipTone('UNKNOWN_STATE')).toBe('neutral')
    expect(orderStatusChipTone('SUCCESS')).toBe('success')
    expect(orderStatusChipTone('PENDING')).toBe('warning')
    expect(orderStatusChipTone('CANCELLED')).toBe('danger')
    expect(orderStatusChipTone('FULFILLED')).toBe('success')
    expect(orderStatusChipTone('PARTIALLY_FULFILLED')).toBe('warning')
  })

  it('handles missing customer and addresses safely', () => {
    const html = renderToStaticMarkup(
      <OrderDetailView
        order={buildOrder({
          customer: null,
          email: '',
          shippingSummary: { address: null },
          billingAddress: null,
        })}
      />
    )

    expect(html).toContain('Guest customer')
    expect(html).toContain('No email')
    expect(html).toContain('No phone')
    expect(html).toContain('Not provided')
  })

  it('renders fulfillment tracking links when present', () => {
    const html = renderToStaticMarkup(
      <OrderDetailView
        order={buildOrder({
          fulfillments: [
            {
              id: 'ful_track',
              status: 'SUCCESS',
              carrier: 'FedEx',
              service: 'Express',
              trackingNumber: 'FX999',
              trackingUrl: 'https://fedex.com/track/FX999',
              labelUrl: 'https://labels.example.com/FX999.pdf',
            },
          ],
        })}
      />
    )

    expect(html).toContain('Track shipment')
    expect(html).toContain('Reprint label')
    expect(html).toContain('FX999')
  })

  it('shows all items still unfulfilled in the create fulfillment section', () => {
    const html = renderToStaticMarkup(
      <OrderDetailView
        order={buildOrder({ fulfillments: [] })}
      />
    )

    expect(html).toContain('Hoodie')
    // fulfillableItems has the item since no fulfillments exist
    expect(html).toContain('Large')
  })

  it('shows "All line items are already fulfilled" when nothing remains unfulfilled', () => {
    const html = renderToStaticMarkup(
      <OrderDetailView
        order={buildOrder({
          fulfillments: [
            {
              id: 'ful_complete',
              status: 'SUCCESS',
              carrier: 'UPS',
              items: [{ orderItemId: 'item_1', quantity: 2 }],
            },
          ],
        })}
      />
    )

    expect(html).toContain('All line items are already fulfilled')
  })

  it('shows discount amount in payment summary when discountAmount is positive', () => {
    const html = renderToStaticMarkup(<OrderDetailView order={buildOrder({ discountAmount: 5 })} />)
    // The payment summary should surface the discount line
    expect(html).toContain('Discounts')
  })

  it('renders the "Back to orders" breadcrumb link', () => {
    const html = renderToStaticMarkup(<OrderDetailView order={buildOrder()} />)
    expect(html).toContain('href="/orders"')
    expect(html).toContain('Orders')
  })

  it('renders "Order not found" empty state when order is null', () => {
    const html = renderToStaticMarkup(<OrderDetailView order={null} />)
    expect(html).toContain('Order not found')
    expect(html).toContain('href="/orders"')
  })
})
