import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

const PAGE = 'src/app/(storefront)/checkout/CheckoutClientPage.tsx'

describe('checkout button copy and state', () => {
  it('uses "Review payment" as the idle CTA before payment intent is created', () => {
    const source = read(PAGE)
    expect(source).toContain("'Review payment'")
  })

  it('uses "Loading payment form..." as the loading label while creating payment intent', () => {
    const source = read(PAGE)
    expect(source).toContain("'Loading payment form...'")
    // Must not use the ambiguous old label
    expect(source).not.toContain("'Loading payment...'")
  })

  it('uses "Place order" as the CTA after the payment element is mounted', () => {
    const source = read(PAGE)
    expect(source).toContain("'Place order'")
  })

  it('uses "Placing order..." as the loading label during payment confirmation', () => {
    const source = read(PAGE)
    expect(source).toContain("'Placing order...'")
  })

  it('uses "Edit details" to let the customer return from payment step to address step', () => {
    const source = read(PAGE)
    expect(source).toContain('Edit details')
    expect(source).toContain('resetPaymentStep()')
  })

  it('labels errors "Could not start checkout" before payment intent creation', () => {
    const source = read(PAGE)
    expect(source).toContain("'Could not start checkout'")
  })

  it('labels errors "Payment failed" during payment confirmation', () => {
    const source = read(PAGE)
    // paymentReady ? 'Payment failed' : 'Could not start checkout'
    expect(source).toContain("paymentReady ? 'Payment failed'")
    expect(source).toContain("'Could not start checkout'")
  })

  it('guards "Review payment" / "Place order" button with disabled when required fields are missing', () => {
    const source = read(PAGE)
    // Disabled when creatingIntent or no items or no shipping selected
    expect(source).toContain('disabled={creatingIntent || !items.length || !selectedShippingQuoteId}')
    // Disabled during payment confirmation
    expect(source).toContain('disabled={confirmingPayment}')
  })

  it('does not apply primaryStyle inline when the button is disabled', () => {
    const source = read(PAGE)
    // When disabled, only brandButtonBaseStyle is applied (no primaryStyle that carries color: #080808)
    expect(source).toContain('creatingIntent || !items.length || !selectedShippingQuoteId')
    expect(source).toContain('? brandButtonBaseStyle')
    expect(source).toContain(': { ...brandButtonBaseStyle, ...buttonPresentation.primaryStyle }')
    // primaryStyle must NOT be spread unconditionally onto a button that can be disabled
    const lines = source.split('\n')
    const primaryBtnLines = lines.filter(
      (line) => line.includes('primary-btn') && line.includes('disabled') && line.includes('primaryStyle')
    )
    expect(primaryBtnLines).toHaveLength(0)
  })

  it('uses !important on disabled CSS to guard against accent-color inline style leakage', () => {
    const source = read(PAGE)
    expect(source).toContain('.primary-btn:disabled{')
    expect(source).toContain('color:rgba(255,255,255,0.50)!important')
    expect(source).toContain('background:rgba(255,255,255,0.10)!important')
  })

  it('reads accent color from Brand Kit (accentColor, primaryColor) with a safe fallback', () => {
    const source = read(PAGE)
    // resolveButtonPresentation reads Brand & Appearance tokens from the store
    expect(source).toContain("store?.accentColor || store?.primaryColor || '#c9a86c'")
  })

  it('documents the Brand & Appearance token relationship in a comment', () => {
    const source = read(PAGE)
    expect(source).toContain('Brand & Appearance tokens')
    expect(source).toContain('Brand Kit settings')
    expect(source).toContain('accentColor')
  })

  it('uses "Loading shipping options..." during the shipping rate fetch', () => {
    const source = read(PAGE)
    expect(source).toContain("'Loading shipping options...'")
  })

  it('does not create an order from the browser redirect', () => {
    const source = read(PAGE)
    // The only navigation on success is a router.push to /checkout/success
    // No order creation call (createOrder, POST /api/orders) is made from the client
    expect(source).not.toContain('createOrder')
    expect(source).not.toContain('/api/orders')
    expect(source).toContain("router.push(`/checkout/success")
  })
})
