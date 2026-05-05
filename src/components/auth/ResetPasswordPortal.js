"use client";

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './LoginPortal.module.css';

function DoopifyMark() {
  return (
    <div className={styles.logoBadge} aria-hidden="true">
      <span className={styles.logoGlyph}>D</span>
      <span className={styles.logoHalo} />
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.inputIconSvg}>
      <path d="M12 2.75A4.75 4.75 0 0 0 7.25 7.5v1H6A2.25 2.25 0 0 0 3.75 10.75v8.5A2.25 2.25 0 0 0 6 21.5h12a2.25 2.25 0 0 0 2.25-2.25v-8.5A2.25 2.25 0 0 0 18 8.5h-1.25v-1A4.75 4.75 0 0 0 12 2.75Zm-3.25 5A3.25 3.25 0 0 1 12 4.25a3.25 3.25 0 0 1 3.25 3.25v1h-6.5v-1Zm-2.75 2.5h12c.41 0 .75.34.75.75v8.5a.75.75 0 0 1-.75.75H6a.75.75 0 0 1-.75-.75v-8.5c0-.41.34-.75.75-.75Zm6 2.25a1.75 1.75 0 0 0-.75 3.33v1.42a.75.75 0 0 0 1.5 0v-1.42A1.75 1.75 0 0 0 12 12.5Z" fill="currentColor" />
    </svg>
  );
}

export default function ResetPasswordPortal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tiltStyle, setTiltStyle] = useState({ '--rotate-x': '0deg', '--rotate-y': '0deg' });

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const rotateY = Math.max(-8, Math.min(8, ((event.clientX - rect.left - rect.width / 2) / rect.width) * 16));
    const rotateX = Math.max(-8, Math.min(8, (-(event.clientY - rect.top - rect.height / 2) / rect.height) * 16));
    setTiltStyle({ '--rotate-x': `${rotateX.toFixed(2)}deg`, '--rotate-y': `${rotateY.toFixed(2)}deg` });
  };

  const handleMouseLeave = () => setTiltStyle({ '--rotate-x': '0deg', '--rotate-y': '0deg' });

  const isReady = password.trim().length >= 8 && confirmPassword.trim().length > 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isReady || isLoading) return;

    if (!token) {
      setError('Missing reset token. Check your reset link.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password, confirmNewPassword: confirmPassword }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload?.error || 'Failed to reset password.');
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.replace('/login'), 2500);
    } catch {
      setError('Unable to reach the server. Try again in a moment.');
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <main className={styles.pageShell}>
        <div className={styles.noiseLayer} />
        <div className={styles.topGlow} />
        <div className={styles.bottomGlow} />
        <section className={styles.portalFrame}>
          <div className={styles.cardStage}>
            <div className={styles.portalBadge}>Invalid link</div>
            <p style={{ color: 'var(--color-text-secondary, #aaa)', marginTop: 12 }}>
              This reset link is missing or invalid. Ask your admin to generate a new reset link.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (success) {
    return (
      <main className={styles.pageShell}>
        <div className={styles.noiseLayer} />
        <div className={styles.topGlow} />
        <div className={styles.bottomGlow} />
        <section className={styles.portalFrame}>
          <div className={styles.cardStage}>
            <div className={styles.portalBadge}>Password updated</div>
            <p style={{ color: 'var(--color-text-secondary, #aaa)', marginTop: 12 }}>
              Your password has been reset. Redirecting to login…
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.pageShell}>
      <div className={styles.noiseLayer} />
      <div className={styles.topGlow} />
      <div className={styles.bottomGlow} />
      <div className={styles.sideGlowLeft} />
      <div className={styles.sideGlowRight} />

      <section className={styles.portalFrame}>
        <div className={styles.cardStage}>
          <div className={styles.portalBadge}>Reset password</div>

          <div className={styles.cardTiltWrap} style={tiltStyle} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            <div className={styles.cardAurora} />
            <div className={styles.cardBeamTop} />
            <div className={styles.cardBeamRight} />
            <div className={styles.cardBeamBottom} />
            <div className={styles.cardBeamLeft} />
            <div className={styles.cardGlowRing} />

            <div className={styles.loginCard}>
              <div className={styles.cardPattern} />
              <div className={styles.cardHeader}>
                <DoopifyMark />
                <div className={styles.cardTitleBlock}>
                  <h2 className={styles.cardTitle}>Set new password</h2>
                  <p className={styles.cardSubtitle}>Choose a strong password for your Doopify account.</p>
                </div>
              </div>

              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.fieldStack}>
                  <label className={styles.field}>
                    <span className={styles.inputIcon}><LockIcon /></span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                      placeholder="New password (min 8 characters)"
                      className={styles.input}
                      autoComplete="new-password"
                      required
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.inputIcon}><LockIcon /></span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(''); }}
                      placeholder="Confirm new password"
                      className={styles.input}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                </div>

                {error ? <div className={styles.errorBanner}>{error}</div> : null}

                <button type="submit" disabled={!isReady || isLoading} className={styles.submitButton}>
                  <span className={styles.submitGlow} />
                  <span className={styles.submitInner}>
                    {isLoading ? <span className={styles.spinner} aria-hidden="true" /> : null}
                    <span>{isLoading ? 'Setting password…' : 'Set new password'}</span>
                    {!isLoading ? <span className={styles.arrow}>-&gt;</span> : null}
                  </span>
                </button>
              </form>

              <div className={styles.footerNote}>
                Reset links are single-use and expire after 24 hours. All existing sessions are revoked on reset.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
