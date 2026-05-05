"use client";

import { useState } from 'react';
import AdminButton from '../admin/ui/AdminButton';
import AdminCard from '../admin/ui/AdminCard';
import AdminField from '../admin/ui/AdminField';
import AdminInput from '../admin/ui/AdminInput';
import styles from './SettingsWorkspace.module.css';

export default function AccountSettingsPanel({ currentUser }) {
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionResult, setSessionResult] = useState('');
  const [sessionError, setSessionError] = useState('');

  const setField = (key, value) => {
    setPasswordForm((f) => ({ ...f, [key]: value }));
    if (passwordError) setPasswordError('');
    if (passwordSuccess) setPasswordSuccess(false);
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (passwordLoading) return;

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordError('');
    setPasswordSuccess(false);
    setPasswordLoading(true);

    try {
      const res = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        setPasswordError(payload?.error || 'Failed to change password.');
        return;
      }

      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch {
      setPasswordError('Unable to reach the server. Try again in a moment.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRevokeOthers = async () => {
    if (sessionLoading) return;
    if (!window.confirm('Sign out of all other sessions? This cannot be undone.')) return;

    setSessionError('');
    setSessionResult('');
    setSessionLoading(true);

    try {
      const res = await fetch('/api/auth/sessions/revoke-others', { method: 'POST' });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSessionError(payload?.error || 'Failed to revoke sessions.');
        return;
      }

      const count = payload?.data?.revoked ?? 0;
      setSessionResult(count === 0 ? 'No other sessions to revoke.' : `${count} other session(s) signed out.`);
    } catch {
      setSessionError('Unable to reach the server.');
    } finally {
      setSessionLoading(false);
    }
  };

  return (
    <div className={styles.configStack}>
      <section className={styles.configSection}>
        <div className={styles.sectionHeading}>
          <h3>Account</h3>
          <p className={styles.cardSubtext}>
            Manage your own password and active sessions.
          </p>
        </div>

        {currentUser ? (
          <AdminCard variant="inset" className={styles.compactSettingsCard} as="section">
            <div className={`${styles.setupCardHeader} ${styles.compactSectionHeader}`}>
              <h4>Signed in as</h4>
            </div>
            <p className={styles.compactMeta}>
              <strong>{currentUser.email}</strong> &middot; {currentUser.role}
              {currentUser.firstName ? ` · ${currentUser.firstName}${currentUser.lastName ? ` ${currentUser.lastName}` : ''}` : ''}
            </p>
          </AdminCard>
        ) : null}
      </section>

      <section className={styles.configSection}>
        <div className={styles.sectionHeading}>
          <h3>Change password</h3>
        </div>

        <AdminCard variant="inset" className={styles.compactSettingsCard} as="section">
          <form onSubmit={handleChangePassword}>
            <div className={styles.fieldStack}>
              <AdminField label="Current password">
                <AdminInput
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setField('currentPassword', e.target.value)}
                  placeholder="Your current password"
                  autoComplete="current-password"
                />
              </AdminField>
              <AdminField label="New password">
                <AdminInput
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setField('newPassword', e.target.value)}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                />
              </AdminField>
              <AdminField label="Confirm new password">
                <AdminInput
                  type="password"
                  value={passwordForm.confirmNewPassword}
                  onChange={(e) => setField('confirmNewPassword', e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
              </AdminField>
            </div>

            {passwordError ? (
              <p style={{ color: 'var(--color-danger, #e55)', fontSize: 13, marginTop: 8 }}>{passwordError}</p>
            ) : null}
            {passwordSuccess ? (
              <p style={{ color: 'var(--color-success, #4c8)', fontSize: 13, marginTop: 8 }}>
                Password updated. Other sessions have been signed out.
              </p>
            ) : null}

            <div className={styles.compactActionRow} style={{ marginTop: 16 }}>
              <AdminButton
                type="submit"
                variant="primary"
                disabled={passwordLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmNewPassword}
              >
                {passwordLoading ? 'Updating…' : 'Update password'}
              </AdminButton>
            </div>
          </form>
        </AdminCard>
      </section>

      <section className={styles.configSection}>
        <div className={styles.sectionHeading}>
          <h3>Sessions</h3>
        </div>

        <AdminCard variant="inset" className={styles.compactSettingsCard} as="section">
          <div className={`${styles.setupCardHeader} ${styles.compactSectionHeader}`}>
            <h4>Sign out of other sessions</h4>
          </div>
          <p className={styles.statusText}>
            If you believe your account has been accessed from another device, you can sign out of all other active sessions. Your current session will remain active.
          </p>

          {sessionError ? (
            <p style={{ color: 'var(--color-danger, #e55)', fontSize: 13, marginTop: 8 }}>{sessionError}</p>
          ) : null}
          {sessionResult ? (
            <p style={{ color: 'var(--color-success, #4c8)', fontSize: 13, marginTop: 8 }}>{sessionResult}</p>
          ) : null}

          <div className={styles.compactActionRow} style={{ marginTop: 12 }}>
            <AdminButton variant="secondary" disabled={sessionLoading} onClick={handleRevokeOthers}>
              {sessionLoading ? 'Signing out…' : 'Sign out other sessions'}
            </AdminButton>
          </div>
        </AdminCard>
      </section>
    </div>
  );
}
