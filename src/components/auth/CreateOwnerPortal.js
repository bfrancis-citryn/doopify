"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.inputIconSvg}>
      <path d="M4 6.75h16A1.25 1.25 0 0 1 21.25 8v8A2.25 2.25 0 0 1 19 18.25H5A2.25 2.25 0 0 1 2.75 16V8A1.25 1.25 0 0 1 4 6.75Zm0 1.5a.28.28 0 0 0-.17.05L12 13.78l8.17-5.48a.28.28 0 0 0-.17-.05H4Zm15.75 1.49-7.33 4.91a.75.75 0 0 1-.84 0L4.25 9.74V16c0 .41.34.75.75.75h14c.41 0 .75-.34.75-.75V9.74Z" fill="currentColor" />
    </svg>
  );
}

export default function CreateOwnerPortal() {
  const router = useRouter();
  const [status, setStatus] = useState('checking'); // checking | available | unavailable
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    setupToken: '',
  });
  const [requiresToken, setRequiresToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [tiltStyle, setTiltStyle] = useState({ '--rotate-x': '0deg', '--rotate-y': '0deg' });

  useEffect(() => {
    fetch('/api/bootstrap/owner')
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.data?.bootstrapAvailable === false) {
          setStatus('unavailable');
          setTimeout(() => router.replace('/login'), 2000);
        } else {
          setStatus('available');
          // Peek at env config — if setup token is needed the server will enforce it;
          // we show the field whenever SETUP_TOKEN is configured (indicated by 401 on first attempt).
          // Simpler: always show the field; it's optional if not configured.
          setRequiresToken(false);
        }
      })
      .catch(() => setStatus('available'));
  }, [router]);

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - rect.left - rect.width / 2;
    const offsetY = event.clientY - rect.top - rect.height / 2;
    const rotateY = Math.max(-8, Math.min(8, (offsetX / rect.width) * 16));
    const rotateX = Math.max(-8, Math.min(8, (-offsetY / rect.height) * 16));
    setTiltStyle({ '--rotate-x': `${rotateX.toFixed(2)}deg`, '--rotate-y': `${rotateY.toFixed(2)}deg` });
  };

  const handleMouseLeave = () => {
    setTiltStyle({ '--rotate-x': '0deg', '--rotate-y': '0deg' });
  };

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (error) setError('');
  };

  const isReady =
    form.email.trim() &&
    form.password.trim() &&
    form.confirmPassword.trim() &&
    (!requiresToken || form.setupToken.trim());

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isReady || isLoading) return;

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/bootstrap/owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          password: form.password,
          confirmPassword: form.confirmPassword,
          setupToken: form.setupToken.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = payload?.error || 'Failed to create owner account.';
        // If the error is about setup token, show the token field
        if (msg.toLowerCase().includes('setup token')) {
          setRequiresToken(true);
        }
        setError(msg);
        setIsLoading(false);
        return;
      }

      window.location.assign('/settings');
    } catch {
      setError('Unable to reach the server. Try again in a moment.');
      setIsLoading(false);
    }
  };

  if (status === 'checking') {
    return (
      <main className={styles.pageShell}>
        <div className={styles.noiseLayer} />
        <div className={styles.topGlow} />
        <div className={styles.bottomGlow} />
        <section className={styles.portalFrame}>
          <div className={styles.cardStage}>
            <div className={styles.portalBadge}>Checking setup status…</div>
          </div>
        </section>
      </main>
    );
  }

  if (status === 'unavailable') {
    return (
      <main className={styles.pageShell}>
        <div className={styles.noiseLayer} />
        <div className={styles.topGlow} />
        <div className={styles.bottomGlow} />
        <section className={styles.portalFrame}>
          <div className={styles.cardStage}>
            <div className={styles.portalBadge}>Setup complete</div>
            <p style={{ color: 'var(--color-text-secondary, #aaa)', marginTop: 12 }}>
              Owner account already exists. Redirecting to login…
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
          <div className={styles.portalBadge}>First-run setup</div>

          <div
            className={styles.cardTiltWrap}
            style={tiltStyle}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
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
                  <h2 className={styles.cardTitle}>Create owner account</h2>
                  <p className={styles.cardSubtitle}>
                    Set up the first owner account for your Doopify store. This is a one-time action.
                  </p>
                </div>
              </div>

              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.fieldStack}>
                  <label className={styles.field}>
                    <span className={styles.inputIcon}><MailIcon /></span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setField('email', e.target.value)}
                      placeholder="Email address"
                      className={styles.input}
                      autoComplete="email"
                      required
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.inputIcon}><LockIcon /></span>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => setField('firstName', e.target.value)}
                      placeholder="First name (optional)"
                      className={styles.input}
                      autoComplete="given-name"
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.inputIcon}><LockIcon /></span>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setField('lastName', e.target.value)}
                      placeholder="Last name (optional)"
                      className={styles.input}
                      autoComplete="family-name"
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.inputIcon}><LockIcon /></span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setField('password', e.target.value)}
                      placeholder="Password (min 8 characters)"
                      className={styles.input}
                      autoComplete="new-password"
                      required
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.inputIcon}><LockIcon /></span>
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) => setField('confirmPassword', e.target.value)}
                      placeholder="Confirm password"
                      className={styles.input}
                      autoComplete="new-password"
                      required
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.inputIcon}><LockIcon /></span>
                    <input
                      type="text"
                      value={form.setupToken}
                      onChange={(e) => setField('setupToken', e.target.value)}
                      placeholder={requiresToken ? 'Setup token (required)' : 'Setup token (optional)'}
                      className={styles.input}
                      autoComplete="off"
                    />
                  </label>
                </div>

                {error ? <div className={styles.errorBanner}>{error}</div> : null}

                <button
                  type="submit"
                  disabled={!isReady || isLoading}
                  className={styles.submitButton}
                >
                  <span className={styles.submitGlow} />
                  <span className={styles.submitInner}>
                    {isLoading ? <span className={styles.spinner} aria-hidden="true" /> : null}
                    <span>{isLoading ? 'Creating account…' : 'Create owner account'}</span>
                    {!isLoading ? <span className={styles.arrow}>-&gt;</span> : null}
                  </span>
                </button>
              </form>

              <div className={styles.footerNote}>
                This page is only accessible when no owner account exists. It closes permanently after first use.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
