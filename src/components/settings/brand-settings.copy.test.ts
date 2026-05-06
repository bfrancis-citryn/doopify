import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('brand settings clarity copy', () => {
  it('explains global brand asset usage in plain language', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).toContain('Used as fallback display name across storefront, checkout, and emails.')
    expect(workspace).toContain('Customer-facing support/reply email.')
    expect(workspace).toContain('Store logo: Used in storefront header, packing slips, and default customer email branding.')
    expect(workspace).toContain('Favicon: Used in browser tabs and storefront metadata.')
  })

  it('avoids ambiguous generic usage copy', () => {
    const workspace = read('src/components/settings/SettingsWorkspace.js')

    expect(workspace).not.toContain('Used in theme')
  })
})
