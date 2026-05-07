import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('settings skeleton integration', () => {
  it('uses shared settings skeleton primitives in workspace', () => {
    const source = read('src/components/settings/SettingsWorkspace.js')

    expect(source).toContain("import SettingsPageSkeleton from './SettingsSkeletons'")
    expect(source).toContain('isSettingsTabLoadingState')
    expect(source).toContain('activeTabLoading')
    expect(source).toContain('<SettingsPageSkeleton section={activeSection} />')
  })

  it('keeps header save action disabled while active tab skeleton is visible', () => {
    const source = read('src/components/settings/SettingsWorkspace.js')
    expect(source).toContain('activeTabLoading ||')
  })

  it('replaces shipping loading text with a shipping skeleton', () => {
    const source = read('src/components/settings/ShippingSettingsWorkspace.js')
    expect(source).toContain('<SettingsPageSkeleton section="shipping" />')
    expect(source).not.toContain('Loading shipping settings...')
  })

  it('replaces team loading text with a team skeleton', () => {
    const source = read('src/components/settings/TeamSettingsPanel.js')
    expect(source).toContain('<SettingsPageSkeleton section="team" />')
    expect(source).not.toContain('Loading team')
  })

  it('uses webhooks skeleton in integrations panel loading states', () => {
    const source = read('src/components/settings/IntegrationsPanel.js')
    expect(source).toContain('<SettingsPageSkeleton section="webhooks" />')
    expect(source).not.toContain('Loading endpoints...')
    expect(source).not.toContain('Checking retries and failures...')
  })
})
