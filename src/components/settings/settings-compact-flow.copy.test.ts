import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { WEBHOOK_EVENT_GROUPS, webhookEventsFromGroups, webhookGroupsFromEvents } from './webhooks-settings.helpers'

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('settings compact flow', () => {
  it('uses General as the default settings tab and does not default to Brand kit', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain("{ id: 'general', label: 'General' }")
    expect(workspace).toContain("const [activeSection, setActiveSection] = useState('general')")
  })

  it('uses Shipping & delivery tab and splits taxes into a separate tab', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain("{ id: 'shipping', label: 'Shipping & delivery' }")
    expect(workspace).toContain("{ id: 'taxes', label: 'Taxes & duties' }")
    expect(workspace).not.toContain("{ id: 'shipping', label: 'Shipping & tax' }")
    expect(workspace).toContain("activeSection === 'shipping' ? (")
    expect(workspace).toContain('onModeSaveStateChange={handleShippingModeSaveStateChange}')
    expect(workspace).toContain('onRegisterSaveAction={handleRegisterShippingModeSaveAction}')
    expect(workspace).toContain("activeSection === 'taxes'")
  })

  it('keeps Taxes & duties tax-only and excludes shipping setup UI', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')
    const taxesStart = workspace.indexOf("activeSection === 'taxes' ? (")
    const paymentsStart = workspace.indexOf("activeSection === 'payments' ? (")
    const taxesBlock =
      taxesStart >= 0 && paymentsStart > taxesStart ? workspace.slice(taxesStart, paymentsStart) : ''

    expect(taxesBlock).toContain('Tax collection')
    expect(taxesBlock).toContain('Tax regions')
    expect(taxesBlock).toContain('Duties & import taxes')
    expect(taxesBlock).toContain('Customs information')
    expect(taxesBlock).toContain('Tax preview')

    expect(taxesBlock).not.toContain('Shipping provider setup')
    expect(taxesBlock).not.toContain('Shippo')
    expect(taxesBlock).not.toContain('EasyPost')
    expect(taxesBlock).not.toContain('Manual rates')
    expect(taxesBlock).not.toContain('Live rates mode')
    expect(taxesBlock).not.toContain('Shipping zones')
    expect(taxesBlock).not.toContain('Shipping rate')
  })

  it('renames Storefront / brand to Brand & appearance and explains scope clearly', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain("{ id: 'brand-kit', label: 'Brand & appearance' }")
    expect(workspace).toContain('Brand settings control the default look of your storefront, checkout, customer emails, and printed documents.')
    expect(workspace).toContain('Email wording is edited in Settings -&gt; Email.')
  })

  it('keeps Brand and Email cross-navigation explicit for template wording edits', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain('Want to change email wording? Manage customer email templates in Settings -&gt; Email.')
    expect(workspace).toContain('<Link href="/admin/settings?section=email">Open email templates</Link>')
  })

  it('polishes General address card without a fake coming-soon editor', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain("<h4>Store address</h4>")
    expect(workspace).toContain('No store address configured')
    expect(workspace).not.toContain('Address editor')
    expect(workspace).not.toContain('Address editing will be expanded here.')
  })

  it('keeps Payments rows compact with drawer-based management', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain('compactProviderRow')
    expect(workspace).toContain('onClick={() => openPaymentDrawer(providerRow.id)}')
    expect(workspace).toContain('open={Boolean(activePaymentDrawer)}')
  })

  it('renders compact Stripe drawer status labels and keeps secret metadata masked', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain('<strong>API keys:</strong>')
    expect(workspace).toContain('<strong>Runtime:</strong>')
    expect(workspace).toContain('<strong>Webhook:</strong>')
    expect(workspace).toContain('<strong>Webhook endpoint:</strong>')
    expect(workspace).toContain('<strong>Verified:</strong>')
    expect(workspace).toContain('Credentials saved securely. Secret values are encrypted and hidden.')
    expect(workspace).toContain('Create this endpoint in Stripe and paste the whsec signing secret here. Orders are only created after this webhook succeeds.')
    expect(workspace).toContain('Store URL needs setup')
  })

  it('keeps PayPal and SendLayer drawers honest without fake editable credential forms', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).not.toContain('PayPal client id (future)')
    expect(workspace).not.toContain('sendlayer api key (future)')
    expect(workspace).toContain('<strong>Checkout visibility:</strong> Hidden')
    expect(workspace).toContain('<strong>Runtime:</strong> Not implemented')
  })

  it('keeps the manual payments drawer compact with instructions and safety warning', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain('Cash instructions')
    expect(workspace).toContain('Bank transfer instructions')
    expect(workspace).toContain('Save instructions')
    expect(workspace).toContain('Manual storefront checkout is disabled until server-owned manual payment finalization is implemented.')
  })

  it('renders Webhooks as a compact endpoint manager instead of the old giant add form', () => {
    const integrationsPanel = read('src/components/settings/IntegrationsPanel.js')

    expect(integrationsPanel).toContain('Connected endpoints')
    expect(integrationsPanel).toContain('Needs attention')
    expect(integrationsPanel).toContain('Create endpoint')
    expect(integrationsPanel).toContain('open={Boolean(drawerMode)}')
    expect(integrationsPanel).not.toContain('Add integration')
    expect(integrationsPanel).not.toContain('Subscribed events')
  })

  it('applies compact drawer cards to shipping provider manage flow', () => {
    const shippingWorkspace = read('src/components/settings/ShippingSettingsWorkspace.js')

    expect(shippingWorkspace).toContain('title="Manage provider"')
    expect(shippingWorkspace).toContain('className={styles.compactDrawerCard}')
    expect(shippingWorkspace).toContain('<h4>Advanced</h4>')
  })

  it('includes ship-from email field and helper copy in location drawer', () => {
    const shippingWorkspace = read('src/components/settings/ShippingSettingsWorkspace.js')

    expect(shippingWorkspace).toContain('label="Email"')
    expect(shippingWorkspace).toContain('Used by carriers when buying labels. Required for Shippo/USPS labels.')
    expect(shippingWorkspace).toContain('const normalizedEmail = normalizeOptional(locationForm.email);')
    expect(shippingWorkspace).toContain('email: normalizedEmail,')
    expect(shippingWorkspace).toContain('Ship-from email is required for Shippo/USPS labels.')
  })

  it('keeps brand save behavior with API-backed patching', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain("fetch('/api/settings/brand-kit'")
    expect(workspace).toContain('async function handleBrandKitSave()')
    expect(workspace).toContain("activeSection === 'brand-kit'")
    expect(workspace).toContain("activeSection === 'shipping'")
    expect(workspace).toContain('showHeaderSaveButton')
    expect(workspace).toContain('headerSaveButtonLabel')
  })

  it('supports visible shipping save states in the top-right header', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain('shippingModeSavedState')
    expect(workspace).toContain('shippingModeSaveError')
    expect(workspace).toContain('shippingModeSaveActionRef')
    expect(workspace).toContain('Retry save')
    expect(workspace).toContain("setShippingModeSavedState((current) => (current === 'saved_just_now' ? 'saved' : current))")
  })

  it('clarifies Brand & appearance preview labels and usage copy', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain('<h4>Storefront preview</h4>')
    expect(workspace).toContain('<h4>Checkout preview</h4>')
    expect(workspace).toContain('<h4>Email preview</h4>')
    expect(workspace).toContain('Controls storefront page colors, fonts, and buttons.')
    expect(workspace).toContain('Controls checkout header/logo/button styling where supported.')
    expect(workspace).toContain('Controls customer email logo/header/footer styling.')
    expect(workspace).toContain('Used for storefront logo, favicon, packing slips, and default email branding.')
  })

  it('maps friendly webhook groups only to real typed events', () => {
    const allowedEvents = new Set([
      'order.paid',
      'order.refunded',
      'refund.issued',
      'fulfillment.created',
    ])

    for (const group of WEBHOOK_EVENT_GROUPS) {
      for (const eventName of group.events) {
        expect(allowedEvents.has(eventName)).toBe(true)
      }
    }

    expect(webhookEventsFromGroups(['paid_orders', 'refunds', 'fulfillments'])).toEqual(
      expect.arrayContaining(['order.paid', 'order.refunded', 'refund.issued', 'fulfillment.created'])
    )
    expect(webhookGroupsFromEvents(['order.paid', 'fulfillment.created'])).toEqual(
      expect.arrayContaining(['paid_orders', 'fulfillments'])
    )
  })
})
