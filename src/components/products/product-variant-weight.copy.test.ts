import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('product variant weight UI contract', () => {
  it('uses admin-styled weight controls and removes inline clipping styles', () => {
    const sourcePath = path.resolve(process.cwd(), 'src/components/products/ProductVariantEditor.js')
    const source = fs.readFileSync(sourcePath, 'utf8')

    expect(source).toContain('className={`admin-input ${styles.weightInput}`}')
    expect(source).toContain('className={`admin-input ${styles.weightUnitSelect}`}')
    expect(source).not.toContain('maxWidth')
  })

  it('keeps supported weight units visible for oz/lb/g/kg', () => {
    const sourcePath = path.resolve(process.cwd(), 'src/components/products/ProductVariantEditor.js')
    const source = fs.readFileSync(sourcePath, 'utf8')

    expect(source).toContain("const WEIGHT_UNIT_OPTIONS = ['g', 'kg', 'oz', 'lb'];")
  })

  it('sets wider CSS widths so decimal values are not clipped', () => {
    const cssPath = path.resolve(process.cwd(), 'src/components/products/ProductVariantEditor.module.css')
    const css = fs.readFileSync(cssPath, 'utf8')

    expect(css).toContain('width: 6.5rem;')
    expect(css).toContain('min-width: 6.5rem;')
    expect(css).toContain('width: 4.75rem;')
    expect(css).toContain('min-width: 4.75rem;')
  })
})
