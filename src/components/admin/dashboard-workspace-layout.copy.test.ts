import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('AdminDashboardWorkspace layout and empty-state contract', () => {
  it('renders setup panel above the main dashboard grid', () => {
    const sourcePath = path.resolve(process.cwd(), 'src/components/admin/AdminDashboardWorkspace.js')
    const source = fs.readFileSync(sourcePath, 'utf8')

    const setupIdx = source.indexOf('className={styles.setupPanel}')
    const gridIdx = source.indexOf('className={styles.grid}')
    expect(setupIdx).toBeGreaterThan(-1)
    expect(gridIdx).toBeGreaterThan(-1)
    expect(setupIdx).toBeLessThan(gridIdx)
  })

  it('does not ship fake recent activity fallback rows for fresh installs', () => {
    const sourcePath = path.resolve(process.cwd(), 'src/components/admin/AdminDashboardWorkspace.js')
    const source = fs.readFileSync(sourcePath, 'utf8')

    expect(source).not.toContain('Catalog sync completed successfully.')
    expect(source).not.toContain('Customer profiles are synced.')
    expect(source).not.toContain('FALLBACK_ACTIVITY')
  })

  it('renders explicit empty activity state copy with CTAs', () => {
    const sourcePath = path.resolve(process.cwd(), 'src/components/admin/AdminDashboardWorkspace.js')
    const source = fs.readFileSync(sourcePath, 'utf8')

    expect(source).toContain('No activity yet')
    expect(source).toContain('Create your first product or complete a test checkout to start building the activity feed.')
    expect(source).toContain('Add product')
    expect(source).toContain('Open setup')
  })

  it('keeps main grid focused on activity + side rail and removes guide grid area', () => {
    const cssPath = path.resolve(process.cwd(), 'src/components/admin/AdminDashboardWorkspace.module.css')
    const css = fs.readFileSync(cssPath, 'utf8')

    expect(css).not.toContain('"activity health"')
    expect(css).not.toContain('"activity links"')
    expect(css).not.toContain('"activity guide"')
    expect(css).toContain('.sideRail')
    expect(css).toContain('align-items: start;')
  })
})

