import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('email settings compact workspace copy', () => {
  it('uses compact customer-email-focused sections', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain('<h3>Customer email system</h3>')
    expect(workspace).toContain('<h4>Email providers</h4>')
    expect(workspace).toContain('<h4>Sender identity</h4>')
    expect(workspace).toContain('<h4>Email branding</h4>')
    expect(workspace).toContain('<h4>Customer email templates</h4>')
    expect(workspace).toContain('<h4>Recent email activity</h4>')
  })

  it('shows template trigger context and manage actions with honest editor availability', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain('<strong>Trigger:</strong> {template.triggerLabel}')
    expect(workspace).toContain('onClick={() => openEmailTemplateDrawer(template.id)}')
    expect(workspace).toContain('Template editor coming soon')
    expect(workspace).toContain('open={Boolean(activeEmailTemplate)}')
  })

  it('disables the legacy inline-email-provider block and keeps drawer-based manage flows', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain("activeSection === 'email-legacy'")
    expect(workspace).toContain('onClick={() => openEmailDrawer(providerRow.id)}')
    expect(workspace).toContain('open={Boolean(activeEmailDrawer)}')
    expect(workspace).toContain('title={')
  })
})
