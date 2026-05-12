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

  it('renders compact manage menus for users and pending invites', () => {
    const panel = read('src/components/settings/TeamSettingsPanel.js')
    const styles = read('src/components/settings/SettingsWorkspace.module.css')

    expect(panel).toContain('aria-label={`Manage ${user.email}`}')
    expect(panel).toContain('aria-label={`Manage invite ${invite.email}`}')
    expect(panel).toContain('<AdminDropdown')
    expect(panel).toContain('Change role')
    expect(panel).toContain('Reset password')
    expect(panel).toContain('Revoke sessions')
    expect(panel).toContain('Disable user')
    expect(panel).toContain('Reactivate user')
    expect(panel).toContain('Resend')
    expect(panel).toContain('Revoke')
    expect(panel).not.toContain('Change role</AdminButton>')
    expect(panel).not.toContain('Disable</AdminButton>')

    expect(styles).toContain('.teamRowLayout')
    expect(styles).toContain('.teamRowActions')
    expect(styles).toContain('.teamRoleEditor')
    expect(styles).toContain('.teamHeaderActions')
  })

  it('uses existing owner-only team APIs for menu actions', () => {
    const panel = read('src/components/settings/TeamSettingsPanel.js')

    expect(panel).toContain("fetch(`/api/team/users/${userId}/reset-password`, { method: 'POST' })")
    expect(panel).toContain("fetch(`/api/team/users/${userId}/sessions`, { method: 'DELETE' })")
    expect(panel).toContain("fetch(`/api/team/invites/${inviteId}/resend`, { method: 'POST' })")
    expect(panel).toContain("fetch(`/api/team/invites/${inviteId}`, { method: 'DELETE' })")
    expect(panel).toContain('if (!window.confirm(`Disable ${user.email}? They will be signed out immediately.`)) return;')
    expect(panel).toContain('if (!window.confirm(`Revoke all active sessions for ${email}?`)) return;')
    expect(panel).toContain('if (!window.confirm(`Revoke invite for ${email}?`)) return;')
    expect(panel).toContain('Add another active owner before disabling this account.')
  })
})
