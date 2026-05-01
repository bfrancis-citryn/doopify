import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('DraftOrdersWorkspace pricing and save behavior copy', () => {
  it('labels quantity and requires explicit price override UI', () => {
    const file = read('src/components/draft-orders/DraftOrdersWorkspace.js')
    expect(file).toContain('label="Quantity"')
    expect(file).toContain('label="Unit price"')
    expect(file).toContain('Override price')
    expect(file).toContain('label="Override reason"')
  })

  it('does not expose a fake clickable Save draft action', () => {
    const file = read('src/components/draft-orders/DraftOrdersWorkspace.js')
    expect(file).toContain('Save draft (not available yet)')
    expect(file).toContain('disabled size="sm" variant="secondary"')
  })
})
