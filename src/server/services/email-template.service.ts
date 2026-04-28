import { getStoreSettings } from '@/server/services/settings.service'

export type OrderConfirmationInput = {
  orderId?: string
  orderNumber: number
  email: string
  currency: string
  total: number
  items: Array<{
    title: string
    variantTitle?: string | null
    quantity: number
    price: number
  }>
  shippingAddress?: {
    firstName?: string | null
    lastName?: string | null
    address1?: string | null
    city?: string | null
    province?: string | null
    postalCode?: string | null
    country?: string | null
  } | null
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}

function formatAddress(address: OrderConfirmationInput['shippingAddress']) {
  if (!address) return 'No shipping address provided.'

  return [
    [address.firstName, address.lastName].filter(Boolean).join(' ').trim(),
    address.address1,
    [address.city, address.province, address.postalCode].filter(Boolean).join(', '),
    address.country,
  ]
    .filter(Boolean)
    .join('<br />')
}

function buildOrderConfirmationHtml(input: OrderConfirmationInput, storeName: string) {
  const itemRows = input.items
    .map((item) => {
      const itemTitle = item.variantTitle ? `${item.title} - ${item.variantTitle}` : item.title
      return `<tr>
        <td style="padding:8px 0;color:#111827;">${itemTitle}</td>
        <td style="padding:8px 0;color:#6b7280;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 0;color:#111827;text-align:right;">${formatMoney(item.price * item.quantity, input.currency)}</td>
      </tr>`
    })
    .join('')

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;color:#111827;">
      <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin-bottom:16px;">${storeName}</p>
      <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">Order confirmation</h1>
      <p style="font-size:16px;color:#4b5563;margin:0 0 24px;">Thanks for your purchase. Your order <strong>#${input.orderNumber}</strong> is confirmed.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr>
            <th style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:left;font-size:12px;color:#6b7280;">Item</th>
            <th style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;">Qty</th>
            <th style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;color:#6b7280;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="font-size:18px;margin:0 0 24px;"><strong>Total:</strong> ${formatMoney(input.total, input.currency)}</p>
      <div style="padding:20px;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">Shipping address</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#111827;">${formatAddress(input.shippingAddress)}</p>
      </div>
    </div>
  `
}

export async function buildOrderConfirmationEmailMessage(input: OrderConfirmationInput) {
  const store = await getStoreSettings()
  const storeName = store?.name || 'Doopify'
  const from = store?.email || 'orders@doopify.local'
  const subject = `${storeName} order #${input.orderNumber} confirmation`
  const html = buildOrderConfirmationHtml(input, storeName)

  return {
    from,
    subject,
    html,
  }
}
