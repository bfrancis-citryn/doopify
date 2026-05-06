import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('Sidebar branding copy', () => {
  it('uses neutral Doopify branding text', () => {
    const sidebar = read('src/components/Sidebar/Sidebar.js')

    expect(sidebar).toContain('Doopify')
    expect(sidebar).toContain('Commerce admin')
    expect(sidebar).not.toContain('Obsidian Glass')
    expect(sidebar).not.toContain('Commerce command layer')
  })
})
