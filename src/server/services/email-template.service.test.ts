import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getStoreSettings: vi.fn(),
}))

vi.mock('@/server/services/settings.service', () => ({
  getStoreSettings: mocks.getStoreSettings,
}))

import { buildOrderConfirmationEmailMessage } from './email-template.service'

describe('email template service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStoreSettings.mockResolvedValue({
      name: 'Doopify & Co',
      email: 'orders@example.com',
    })
  })

  it('escapes dynamic html fields in order confirmation template output', async () => {
    const message = await buildOrderConfirmationEmailMessage({
      orderNumber: 1001,
      orderId: 'order-1',
      email: 'customer@example.com',
      currency: 'USD',
      total: 59.99,
      items: [
        {
          title: '<script>alert(1)</script>',
          variantTitle: `L & "Blue"`,
          quantity: 1,
          price: 59.99,
        },
      ],
      shippingAddress: {
        firstName: 'Ada <img>',
        lastName: `O'Neil`,
        address1: '1 <Compute> Way',
        city: 'London',
        province: 'N/A',
        postalCode: 'N1 1AA',
        country: 'GB',
      },
    })

    expect(message.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; - L &amp; &quot;Blue&quot;')
    expect(message.html).toContain('Ada &lt;img&gt; O&#39;Neil')
    expect(message.html).toContain('1 &lt;Compute&gt; Way')
    expect(message.html).toContain('Doopify &amp; Co')
    expect(message.html).not.toContain('<script>alert(1)</script>')
  })
})
