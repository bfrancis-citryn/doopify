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

export type AbandonedCheckoutRecoveryInput = {
  checkoutSessionId: string
  email: string
  currency: string
  totalCents: number
  recoveryUrl: string
  items: Array<{
    title: string
    variantTitle?: string
    quantity: number
  }>
}

export type FulfillmentTrackingEmailInput = {
  orderNumber: number
  email: string
  trackingNumber?: string | null
  trackingUrl?: string | null
  carrier?: string | null
  service?: string | null
  items: Array<{
    title: string
    variantTitle?: string | null
    quantity: number
  }>
}

type EmailBranding = {
  logoUrl: string | null
  headerColor: string
  footerText: string
  supportEmail: string | null
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}

function resolveEmailBranding(
  store: Awaited<ReturnType<typeof getStoreSettings>>
): EmailBranding {
  return {
    logoUrl: store?.emailLogoUrl || store?.logoUrl || null,
    headerColor: store?.emailHeaderColor || store?.primaryColor || '#111827',
    footerText: store?.emailFooterText || 'Thanks for choosing us.',
    supportEmail: store?.supportEmail || store?.email || null,
  }
}

function renderEmailHeader(storeName: string, branding: EmailBranding) {
  return `
    <div style="padding:18px 22px;background:${escapeHtml(branding.headerColor)};border-radius:14px 14px 0 0;display:flex;align-items:center;justify-content:space-between;gap:16px;">
      ${
        branding.logoUrl
          ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(storeName)}" style="display:block;max-height:38px;width:auto;" />`
          : `<strong style="font-size:14px;color:#ffffff;letter-spacing:0.1em;text-transform:uppercase;">${escapeHtml(storeName)}</strong>`
      }
      ${
        branding.supportEmail
          ? `<span style="font-size:12px;color:rgba(255,255,255,0.92);">${escapeHtml(branding.supportEmail)}</span>`
          : ''
      }
    </div>
  `
}

function renderEmailFooter(branding: EmailBranding) {
  return `
    <div style="padding:14px 22px;border-top:1px solid #e5e7eb;background:#f9fafb;border-radius:0 0 14px 14px;">
      <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">${escapeHtml(branding.footerText)}</p>
    </div>
  `
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
    .map((segment) => escapeHtml(segment))
    .join('<br />')
}

function buildOrderConfirmationHtml(
  input: OrderConfirmationInput,
  storeName: string,
  branding: EmailBranding
) {
  const itemRows = input.items
    .map((item) => {
      const itemTitle = item.variantTitle ? `${item.title} - ${item.variantTitle}` : item.title
      return `<tr>
        <td style="padding:8px 0;color:#111827;">${escapeHtml(itemTitle)}</td>
        <td style="padding:8px 0;color:#6b7280;text-align:center;">${escapeHtml(item.quantity)}</td>
        <td style="padding:8px 0;color:#111827;text-align:right;">${formatMoney(item.price * item.quantity, input.currency)}</td>
      </tr>`
    })
    .join('')

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
      ${renderEmailHeader(storeName, branding)}
      <div style="padding:28px 22px;background:#ffffff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
        <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin-bottom:16px;">${escapeHtml(storeName)}</p>
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">Order confirmation</h1>
        <p style="font-size:16px;color:#4b5563;margin:0 0 24px;">Thanks for your purchase. Your order <strong>#${escapeHtml(input.orderNumber)}</strong> is confirmed.</p>
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
      ${renderEmailFooter(branding)}
    </div>
  `
}

function buildAbandonedCheckoutRecoveryHtml(
  input: AbandonedCheckoutRecoveryInput,
  storeName: string,
  branding: EmailBranding
) {
  const itemRows = input.items
    .map((item) => {
      const itemLabel = item.variantTitle ? `${item.title} - ${item.variantTitle}` : item.title
      return `<li style="margin:0 0 8px;color:#111827;">${escapeHtml(itemLabel)} x ${escapeHtml(
        item.quantity
      )}</li>`
    })
    .join('')

  const recoveredTotal = formatMoney(input.totalCents / 100, input.currency)
  const itemsSection = itemRows
    ? `<ul style="padding-left:18px;margin:0 0 18px;">${itemRows}</ul>`
    : '<p style="margin:0 0 18px;color:#4b5563;">Your cart items are ready to restore.</p>'

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
      ${renderEmailHeader(storeName, branding)}
      <div style="padding:28px 22px;background:#ffffff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
        <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin-bottom:16px;">${escapeHtml(storeName)}</p>
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">You left something behind</h1>
        <p style="font-size:16px;color:#4b5563;margin:0 0 16px;">Your checkout is still available. Pick up where you left off.</p>
        ${itemsSection}
        <p style="font-size:18px;margin:0 0 24px;"><strong>Estimated total:</strong> ${escapeHtml(recoveredTotal)}</p>
        <a href="${escapeHtml(input.recoveryUrl)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#111827;color:#ffffff;text-decoration:none;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;">Resume checkout</a>
        <p style="margin:20px 0 0;color:#6b7280;font-size:12px;">If you already completed this purchase, you can ignore this message.</p>
      </div>
      ${renderEmailFooter(branding)}
    </div>
  `
}

function buildFulfillmentTrackingHtml(
  input: FulfillmentTrackingEmailInput,
  storeName: string,
  branding: EmailBranding
) {
  const itemRows = input.items
    .map((item) => {
      const itemLabel = item.variantTitle ? `${item.title} - ${item.variantTitle}` : item.title
      return `<li style="margin:0 0 8px;color:#111827;">${escapeHtml(itemLabel)} x ${escapeHtml(
        item.quantity
      )}</li>`
    })
    .join('')

  const carrierLine = [input.carrier, input.service].filter(Boolean).join(' ')
  const trackingText = input.trackingNumber ? `Tracking #${input.trackingNumber}` : 'Tracking details pending'
  const trackingHref = input.trackingUrl?.trim()

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
      ${renderEmailHeader(storeName, branding)}
      <div style="padding:28px 22px;background:#ffffff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
        <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin-bottom:16px;">${escapeHtml(storeName)}</p>
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">Your order is on the way</h1>
        <p style="font-size:16px;color:#4b5563;margin:0 0 16px;">Order <strong>#${escapeHtml(input.orderNumber)}</strong> has shipped.</p>
        ${
          carrierLine
            ? `<p style="margin:0 0 12px;font-size:14px;color:#111827;"><strong>Carrier:</strong> ${escapeHtml(carrierLine)}</p>`
            : ''
        }
        <p style="margin:0 0 20px;font-size:14px;color:#111827;"><strong>${escapeHtml(trackingText)}</strong></p>
        ${
          trackingHref
            ? `<a href="${escapeHtml(trackingHref)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#111827;color:#ffffff;text-decoration:none;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:22px;">Track shipment</a>`
            : ''
        }
        ${
          itemRows
            ? `<div style="padding:20px;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;">
                <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">Items in this shipment</p>
                <ul style="padding-left:18px;margin:0;">${itemRows}</ul>
              </div>`
            : ''
        }
      </div>
      ${renderEmailFooter(branding)}
    </div>
  `
}

export async function buildOrderConfirmationEmailMessage(input: OrderConfirmationInput) {
  const store = await getStoreSettings()
  const storeName = store?.name || 'Doopify'
  const from = store?.email || 'orders@doopify.local'
  const branding = resolveEmailBranding(store)
  const subject = `${storeName} order #${input.orderNumber} confirmation`
  const html = buildOrderConfirmationHtml(input, storeName, branding)

  return {
    from,
    subject,
    html,
  }
}

export async function buildAbandonedCheckoutRecoveryEmailMessage(input: AbandonedCheckoutRecoveryInput) {
  const store = await getStoreSettings()
  const storeName = store?.name || 'Doopify'
  const from = store?.email || 'orders@doopify.local'
  const branding = resolveEmailBranding(store)
  const subject = `${storeName}: you left something behind`
  const html = buildAbandonedCheckoutRecoveryHtml(input, storeName, branding)

  return {
    from,
    subject,
    html,
  }
}

export async function buildFulfillmentTrackingEmailMessage(input: FulfillmentTrackingEmailInput) {
  const store = await getStoreSettings()
  const storeName = store?.name || 'Doopify'
  const from = store?.email || 'orders@doopify.local'
  const branding = resolveEmailBranding(store)
  const subject = `${storeName} shipping update for order #${input.orderNumber}`
  const html = buildFulfillmentTrackingHtml(input, storeName, branding)

  return {
    from,
    subject,
    html,
  }
}
