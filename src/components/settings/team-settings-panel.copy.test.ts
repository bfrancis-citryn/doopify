import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('TeamSettingsPanel role select wiring', () => {
  it('uses AdminSelect value callbacks instead of DOM event objects', () => {
    const panel = read('src/components/settings/TeamSettingsPanel.js')

    expect(panel).toContain("onChange={(value) => setDrawerField('role', value)}")
    expect(panel).toContain('onChange={(value) => setEditRoleValue(value)}')
    expect(panel).not.toContain("onChange={(e) => setDrawerField('role', e.target.value)}")
    expect(panel).not.toContain('onChange={(e) => setEditRoleValue(e.target.value)}')
  })

  it('posts selected role for invite and direct user creation', () => {
    const panel = read('src/components/settings/TeamSettingsPanel.js')

    expect(panel).toContain("fetch('/api/team/invites'")
    expect(panel).toContain("body: JSON.stringify({ email: drawerForm.email, role: drawerForm.role })")
    expect(panel).toContain("fetch('/api/team/users'")
    expect(panel).toContain('role: drawerForm.role,')
    expect(panel).toContain('{ROLE_DESCRIPTIONS[drawerForm.role]}')
  })

  it('sends selected edit role when applying set_role updates', () => {
    const panel = read('src/components/settings/TeamSettingsPanel.js')

    expect(panel).toContain("onClick={() => patchUser(user.id, 'set_role', { role: editRoleValue })}")
    expect(panel).toContain("body: JSON.stringify({ action, ...extra })")
  })
})
