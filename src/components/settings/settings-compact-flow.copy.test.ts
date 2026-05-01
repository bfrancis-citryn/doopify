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

  it('keeps Payments rows compact with drawer-based management', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain('compactProviderRow')
    expect(workspace).toContain('onClick={() => openPaymentDrawer(providerRow.id)}')
    expect(workspace).toContain('open={Boolean(activePaymentDrawer)}')
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
