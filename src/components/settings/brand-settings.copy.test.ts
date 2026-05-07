import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('brand settings clarity copy', () => {
  it('shows private-beta lock messaging for theme customization', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain('Theme customization is locked for private beta.')
    expect(workspace).toContain('Brand assets')
    expect(workspace).not.toContain('Storefront theme')
  })

  it('explains global brand asset usage in plain language', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain('Used as fallback display name across storefront, checkout, and emails.')
    expect(workspace).toContain('Customer-facing support/reply email.')
    expect(workspace).toContain('Support phone:')
    expect(workspace).toContain('Store logo: Used in storefront header, packing slips, and default customer email branding.')
    expect(workspace).toContain('Favicon: Used in browser tabs and storefront metadata.')
  })

  it('keeps brand asset and email asset controls available for save flow', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain("renderAssetUploadField({ field: 'logoUrl', label: 'Store logo'")
    expect(workspace).toContain("renderAssetUploadField({ field: 'faviconUrl', label: 'Favicon'")
    expect(workspace).toContain("renderAssetUploadField({ field: 'checkoutLogoUrl', label: 'Checkout logo'")
    expect(workspace).toContain("renderAssetUploadField({ field: 'emailLogoUrl', label: 'Email logo'")
    expect(workspace).toContain('<span>Email footer text</span>')
    expect(workspace).toContain("fetch('/api/settings/brand-kit'")
  })

  it('avoids ambiguous generic usage copy', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).not.toContain('Used in theme')
  })
})
