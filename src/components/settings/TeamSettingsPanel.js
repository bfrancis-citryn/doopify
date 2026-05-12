"use client";

import { useCallback, useEffect, useState } from 'react';
import AdminButton from '../admin/ui/AdminButton';
import AdminCard from '../admin/ui/AdminCard';
import AdminDrawer from '../admin/ui/AdminDrawer';
import AdminField from '../admin/ui/AdminField';
import AdminInput from '../admin/ui/AdminInput';
import AdminSelect from '../admin/ui/AdminSelect';
import AdminStatusChip from '../admin/ui/AdminStatusChip';
import SettingsPageSkeleton from './SettingsSkeletons';
import styles from './SettingsWorkspace.module.css';
import { getTeamAccessNotice, isKnownNonOwnerRole, isOwnerRole } from './team-settings.helpers';

const ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'VIEWER', label: 'Viewer' },
];

const ROLE_DESCRIPTIONS = {
  OWNER: 'Full access including payment credentials, team management, and dangerous settings.',
  ADMIN: 'Products, orders, customers, discounts, media, shipping, and email templates.',
  STAFF: 'Orders, fulfillment, customers, and notes. Limited product view.',
  VIEWER: 'Read-only access to the admin.',
};

function roleChipTone(role) {
  if (role === 'OWNER') return 'success';
  if (role === 'ADMIN') return 'neutral';
  if (role === 'STAFF') return 'neutral';
  return 'neutral';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function parseTeamApiError(response, payload, fallbackMessage) {
  const apiError = typeof payload?.error === 'string' ? payload.error.trim() : '';
  if (apiError) return apiError;

  if (response.status === 403) {
    return 'Team management is owner-only in private beta. Sign in as an OWNER to create users or change roles.';
  }

  return `${fallbackMessage} (HTTP ${response.status})`;
}

export default function TeamSettingsPanel({ currentUserRole }) {
  const isOwner = isOwnerRole(currentUserRole);
  const isKnownNonOwner = isKnownNonOwnerRole(currentUserRole);

  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessNotice, setAccessNotice] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('invite'); // invite | create
  const [drawerForm, setDrawerForm] = useState({ email: '', role: 'STAFF', firstName: '', lastName: '', password: '', confirmPassword: '' });
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState('');
  const [drawerNotice, setDrawerNotice] = useState('');

  const [actionLoading, setActionLoading] = useState({});
  const [actionError, setActionError] = useState({});
  const [editRoleUserId, setEditRoleUserId] = useState('');
  const [editRoleValue, setEditRoleValue] = useState('STAFF');

  const loadTeam = useCallback(async () => {
    if (!currentUserRole) {
      setUsers([]);
      setInvites([]);
      setError('');
      setAccessNotice('');
      return;
    }

    if (!isOwner) {
      setUsers([]);
      setInvites([]);
      setError('');
      setAccessNotice(getTeamAccessNotice(currentUserRole));
      return;
    }

    setLoading(true);
    setError('');
    setAccessNotice('');
    try {
      const [usersRes, invitesRes] = await Promise.all([
        fetch('/api/team/users', { cache: 'no-store' }),
        fetch('/api/team/invites', { cache: 'no-store' }),
      ]);
      const usersPayload = await usersRes.json().catch(() => ({}));
      const invitesPayload = await invitesRes.json().catch(() => ({}));

      if (usersRes.status === 403 || invitesRes.status === 403) {
        setUsers([]);
        setInvites([]);
        setAccessNotice('Team management is owner-only in private beta. Ask an owner to manage invites, roles, and account status.');
        return;
      }

      if (!usersRes.ok || !invitesRes.ok) {
        const message = usersPayload?.error || invitesPayload?.error || 'Failed to load team data.';
        throw new Error(message);
      }

      setUsers(usersPayload?.data?.users || []);
      setInvites(invitesPayload?.data?.invites || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load team data.');
    } finally {
      setLoading(false);
    }
  }, [currentUserRole, isOwner]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const openInviteDrawer = () => {
    setDrawerMode('invite');
    setDrawerForm({ email: '', role: 'STAFF', firstName: '', lastName: '', password: '', confirmPassword: '' });
    setDrawerError('');
    setDrawerNotice('');
    setDrawerOpen(true);
  };

  const openCreateDrawer = () => {
    setDrawerMode('create');
    setDrawerForm({ email: '', role: 'STAFF', firstName: '', lastName: '', password: '', confirmPassword: '' });
    setDrawerError('');
    setDrawerNotice('');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (drawerLoading) return;
    setDrawerOpen(false);
  };

  const setDrawerField = (key, value) => {
    setDrawerForm((f) => ({ ...f, [key]: value }));
    if (drawerError) setDrawerError('');
  };

  const handleDrawerSubmit = async () => {
    if (drawerLoading) return;
    setDrawerError('');
    setDrawerNotice('');
    setDrawerLoading(true);

    try {
      if (drawerMode === 'invite') {
        const res = await fetch('/api/team/invites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: drawerForm.email, role: drawerForm.role }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setDrawerError(parseTeamApiError(res, payload, 'Failed to send invite.'));
          return;
        }
        const token = payload?.data?.inviteToken;
        const inviteUrl = `${window.location.origin}/join?token=${token}`;
        setDrawerNotice(`Invite created. Share this link with ${drawerForm.email}:\n${inviteUrl}`);
        await loadTeam();
      } else {
        if (drawerForm.password !== drawerForm.confirmPassword) {
          setDrawerError('Passwords do not match.');
          return;
        }
        const res = await fetch('/api/team/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: drawerForm.email,
            role: drawerForm.role,
            firstName: drawerForm.firstName || undefined,
            lastName: drawerForm.lastName || undefined,
            password: drawerForm.password,
            confirmPassword: drawerForm.confirmPassword,
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setDrawerError(parseTeamApiError(res, payload, 'Failed to create user.'));
          return;
        }
        setDrawerOpen(false);
        await loadTeam();
      }
    } catch {
      setDrawerError('An error occurred. Please try again.');
    } finally {
      setDrawerLoading(false);
    }
  };

  const patchUser = async (userId, action, extra = {}) => {
    setActionLoading((s) => ({ ...s, [userId]: true }));
    setActionError((s) => ({ ...s, [userId]: '' }));
    try {
      const res = await fetch(`/api/team/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError((s) => ({
          ...s,
          [userId]: parseTeamApiError(res, payload, 'Role or status update failed.'),
        }));
        return;
      }
      setEditRoleUserId('');
      await loadTeam();
    } catch {
      setActionError((s) => ({ ...s, [userId]: 'An error occurred.' }));
    } finally {
      setActionLoading((s) => ({ ...s, [userId]: false }));
    }
  };

  const revokeInvite = async (inviteId) => {
    setActionLoading((s) => ({ ...s, [inviteId]: true }));
    try {
      await fetch(`/api/team/invites/${inviteId}`, { method: 'DELETE' });
      await loadTeam();
    } catch {
      // silent
    } finally {
      setActionLoading((s) => ({ ...s, [inviteId]: false }));
    }
  };

  const resendInvite = async (inviteId, email) => {
    setActionLoading((s) => ({ ...s, [inviteId]: true }));
    setActionError((s) => ({ ...s, [inviteId]: '' }));
    try {
      const res = await fetch(`/api/team/invites/${inviteId}/resend`, { method: 'POST' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError((s) => ({
          ...s,
          [inviteId]: parseTeamApiError(res, payload, 'Failed to resend invite.'),
        }));
        return;
      }
      const token = payload?.data?.inviteToken;
      const inviteUrl = `${window.location.origin}/join?token=${token}`;
      alert(`New invite link for ${email}:\n${inviteUrl}`);
      await loadTeam();
    } catch {
      setActionError((s) => ({ ...s, [inviteId]: 'An error occurred.' }));
    } finally {
      setActionLoading((s) => ({ ...s, [inviteId]: false }));
    }
  };

  return (
    <div className={styles.configStack}>
      <section className={styles.configSection}>
        <div className={styles.sectionHeading}>
          <h3>Team</h3>
          <p className={styles.cardSubtext}>
            Manage who has access to your Doopify admin. Only the Owner can manage team accounts and payment credentials.
          </p>
        </div>

        <AdminCard variant="inset" className={styles.compactSettingsCard} as="section">
          <div className={`${styles.setupCardHeader} ${styles.compactSectionHeader}`}>
            <h4>Roles &amp; permissions</h4>
          </div>
          <div className={styles.compactDrawerGrid}>
            {ROLE_OPTIONS.map((r) => (
              <p key={r.value} className={styles.compactMeta}>
                <strong>{r.label}:</strong> {ROLE_DESCRIPTIONS[r.value]}
              </p>
            ))}
          </div>
        </AdminCard>
      </section>

      {isKnownNonOwner ? (
        <AdminCard variant="card" className={styles.compactSettingsCard}>
          <p className={styles.statusText}>
            Team access is restricted for your role. Owners can manage invites, role changes, and account status.
          </p>
        </AdminCard>
      ) : null}

      {accessNotice ? (
        <AdminCard variant="card" className={styles.compactSettingsCard}>
          <p className={styles.statusText}>{accessNotice}</p>
        </AdminCard>
      ) : null}

      {loading ? <SettingsPageSkeleton section="team" /> : null}

      {error ? (
        <AdminCard variant="card" className={styles.compactSettingsCard}>
          <p className={styles.statusText} style={{ color: 'var(--color-danger, #e55)' }}>{error}</p>
        </AdminCard>
      ) : null}

      {!loading && !error ? (
        <>
          <section className={styles.configSection}>
            <div className={styles.sectionHeading}>
              <h3>Team members</h3>
              {isOwner ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <AdminButton size="sm" variant="secondary" onClick={openInviteDrawer}>Invite member</AdminButton>
                  <AdminButton size="sm" variant="ghost" onClick={openCreateDrawer}>Create directly</AdminButton>
                </div>
              ) : null}
            </div>

            {users.length === 0 ? (
              <AdminCard variant="card" className={styles.compactSettingsCard}>
                <p className={styles.statusText}>
                  No team members yet. Invite your first teammate to share access and keep ownership recovery-safe.
                </p>
              </AdminCard>
            ) : (
              users.map((user) => (
                <AdminCard key={user.id} variant="inset" className={styles.brandRow} spotlight>
                  <div className={styles.rowMeta}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h4 style={{ margin: 0 }}>
                        {user.firstName || user.lastName
                          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                          : user.email}
                      </h4>
                      <AdminStatusChip tone={roleChipTone(user.role)}>{user.role}</AdminStatusChip>
                      {!user.isActive ? <AdminStatusChip tone="danger">Disabled</AdminStatusChip> : null}
                    </div>
                    <p className={styles.compactMeta}>{user.email}</p>
                    <p className={styles.compactMeta}>Last login: {formatDate(user.lastLoginAt)}</p>
                    {actionError[user.id] ? (
                      <p style={{ color: 'var(--color-danger, #e55)', fontSize: 13, marginTop: 4 }}>
                        {actionError[user.id]}
                      </p>
                    ) : null}
                  </div>

                  {isOwner ? (
                    <div className={styles.rowInputs} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      {editRoleUserId === user.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <AdminSelect
                            value={editRoleValue}
                            onChange={(e) => setEditRoleValue(e.target.value)}
                            options={ROLE_OPTIONS}
                          />
                          <AdminButton
                            size="sm"
                            variant="primary"
                            disabled={actionLoading[user.id]}
                            onClick={() => patchUser(user.id, 'set_role', { role: editRoleValue })}
                          >
                            Save
                          </AdminButton>
                          <AdminButton size="sm" variant="ghost" onClick={() => setEditRoleUserId('')}>Cancel</AdminButton>
                        </div>
                      ) : (
                        <AdminButton
                          size="sm"
                          variant="ghost"
                          disabled={actionLoading[user.id]}
                          onClick={() => {
                            setEditRoleUserId(user.id);
                            setEditRoleValue(user.role);
                          }}
                        >
                          Change role
                        </AdminButton>
                      )}

                      {user.isActive ? (
                        <AdminButton
                          size="sm"
                          variant="ghost"
                          disabled={actionLoading[user.id]}
                          onClick={() => {
                            if (!window.confirm(`Disable ${user.email}? They will be signed out immediately.`)) return;
                            patchUser(user.id, 'disable');
                          }}
                        >
                          {actionLoading[user.id] ? 'Disabling…' : 'Disable'}
                        </AdminButton>
                      ) : (
                        <AdminButton
                          size="sm"
                          variant="secondary"
                          disabled={actionLoading[user.id]}
                          onClick={() => patchUser(user.id, 'reactivate')}
                        >
                          {actionLoading[user.id] ? 'Reactivating…' : 'Reactivate'}
                        </AdminButton>
                      )}
                    </div>
                  ) : null}
                </AdminCard>
              ))
            )}
          </section>

          {isOwner ? (
            <section className={styles.configSection}>
              <div className={styles.sectionHeading}>
                <h3>Pending invites</h3>
              </div>
              {invites.length === 0 ? (
                <AdminCard variant="card" className={styles.compactSettingsCard}>
                  <p className={styles.statusText}>
                    No pending invites. Use Invite member to create a single-use join link.
                  </p>
                </AdminCard>
              ) : (
                invites.map((invite) => (
                  <AdminCard key={invite.id} variant="inset" className={styles.brandRow} spotlight>
                    <div className={styles.rowMeta}>
                      <h4 style={{ margin: 0 }}>{invite.email}</h4>
                      <p className={styles.compactMeta}>Role: {invite.role} · Expires: {formatDate(invite.expiresAt)}</p>
                      {actionError[invite.id] ? (
                        <p style={{ color: 'var(--color-danger, #e55)', fontSize: 13, marginTop: 4 }}>
                          {actionError[invite.id]}
                        </p>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <AdminButton
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading[invite.id]}
                        onClick={() => resendInvite(invite.id, invite.email)}
                      >
                        Resend
                      </AdminButton>
                      <AdminButton
                        size="sm"
                        variant="ghost"
                        disabled={actionLoading[invite.id]}
                        onClick={() => revokeInvite(invite.id)}
                      >
                        Revoke
                      </AdminButton>
                    </div>
                  </AdminCard>
                ))
              )}
            </section>
          ) : null}
        </>
      ) : null}

      <AdminDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={drawerMode === 'invite' ? 'Invite team member' : 'Create team member'}
        subtitle={drawerMode === 'invite' ? 'Send an invite link via email.' : 'Create an account directly and share credentials securely.'}
      >
        <div className={styles.drawerStack}>
          <AdminCard variant="card" className={styles.compactDrawerCard} as="section">
            <div className={`${styles.setupCardHeader} ${styles.compactSectionHeader}`}>
              <h4>Account details</h4>
            </div>

            <div className={styles.fieldStack}>
              <AdminField label="Email">
                <AdminInput
                  value={drawerForm.email}
                  onChange={(e) => setDrawerField('email', e.target.value)}
                  placeholder="team@example.com"
                  type="email"
                />
              </AdminField>

              <AdminField label="Role">
                <AdminSelect
                  value={drawerForm.role}
                  onChange={(e) => setDrawerField('role', e.target.value)}
                  options={ROLE_OPTIONS}
                />
                <p className={styles.compactMeta} style={{ marginTop: 4 }}>
                  {ROLE_DESCRIPTIONS[drawerForm.role]}
                </p>
              </AdminField>

              {drawerMode === 'create' ? (
                <>
                  <AdminField label="First name (optional)">
                    <AdminInput
                      value={drawerForm.firstName}
                      onChange={(e) => setDrawerField('firstName', e.target.value)}
                      placeholder="First name"
                    />
                  </AdminField>
                  <AdminField label="Last name (optional)">
                    <AdminInput
                      value={drawerForm.lastName}
                      onChange={(e) => setDrawerField('lastName', e.target.value)}
                      placeholder="Last name"
                    />
                  </AdminField>
                  <AdminField label="Password">
                    <AdminInput
                      value={drawerForm.password}
                      onChange={(e) => setDrawerField('password', e.target.value)}
                      placeholder="Min 8 characters"
                      type="password"
                    />
                  </AdminField>
                  <AdminField label="Confirm password">
                    <AdminInput
                      value={drawerForm.confirmPassword}
                      onChange={(e) => setDrawerField('confirmPassword', e.target.value)}
                      placeholder="Confirm password"
                      type="password"
                    />
                  </AdminField>
                </>
              ) : null}
            </div>

            {drawerError ? (
              <p style={{ color: 'var(--color-danger, #e55)', fontSize: 13, marginTop: 8 }}>{drawerError}</p>
            ) : null}

            {drawerNotice ? (
              <p style={{ color: 'var(--color-success, #4c8)', fontSize: 13, marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{drawerNotice}</p>
            ) : null}

            <div className={styles.compactActionRow} style={{ marginTop: 16 }}>
              <AdminButton
                variant="primary"
                disabled={drawerLoading || !drawerForm.email}
                onClick={handleDrawerSubmit}
              >
                {drawerLoading
                  ? drawerMode === 'invite' ? 'Sending…' : 'Creating…'
                  : drawerMode === 'invite' ? 'Send invite' : 'Create account'}
              </AdminButton>
              <AdminButton variant="ghost" disabled={drawerLoading} onClick={closeDrawer}>
                Cancel
              </AdminButton>
            </div>
          </AdminCard>

          {drawerMode === 'invite' ? (
            <div className={styles.compactInfoStrip}>
              <p className={styles.compactInfoStripTitle}>About invite links</p>
              <p>Invite links are single-use, expire after 7 days, and are stored hashed. Share the generated link securely with the invitee — it is not sent by email automatically.</p>
            </div>
          ) : (
            <div className={styles.compactInfoStrip}>
              <p className={styles.compactInfoStripTitle}>About direct creation</p>
              <p>Share credentials with the new team member securely. Advise them to change their password on first login.</p>
            </div>
          )}
        </div>
      </AdminDrawer>
    </div>
  );
}

