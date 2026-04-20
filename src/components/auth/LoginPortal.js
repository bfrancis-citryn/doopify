"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './LoginPortal.module.css';

const SECURITY_NOTES = ['Private deployment', 'Staff access only', 'Stripe-ready commerce ops'];

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.inputIconSvg}>
      <path d="M4 6.75h16A1.25 1.25 0 0 1 21.25 8v8A2.25 2.25 0 0 1 19 18.25H5A2.25 2.25 0 0 1 2.75 16V8A1.25 1.25 0 0 1 4 6.75Zm0 1.5a.28.28 0 0 0-.17.05L12 13.78l8.17-5.48a.28.28 0 0 0-.17-.05H4Zm15.75 1.49-7.33 4.91a.75.75 0 0 1-.84 0L4.25 9.74V16c0 .41.34.75.75.75h14c.41 0 .75-.34.75-.75V9.74Z" fill="currentColor" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.inputIconSvg}>
      <path d="M12 2.75A4.75 4.75 0 0 0 7.25 7.5v1H6A2.25 2.25 0 0 0 3.75 10.75v8.5A2.25 2.25 0 0 0 6 21.5h12a2.25 2.25 0 0 0 2.25-2.25v-8.5A2.25 2.25 0 0 0 18 8.5h-1.25v-1A4.75 4.75 0 0 0 12 2.75Zm-3.25 5A3.25 3.25 0 0 1 12 4.25a3.25 3.25 0 0 1 3.25 3.25v1h-6.5v-1Zm-2.75 2.5h12c.41 0 .75.34.75.75v8.5a.75.75 0 0 1-.75.75H6a.75.75 0 0 1-.75-.75v-8.5c0-.41.34-.75.75-.75Zm6 2.25a1.75 1.75 0 0 0-.75 3.33v1.42a.75.75 0 0 0 1.5 0v-1.42A1.75 1.75 0 0 0 12 12.5Z" fill="currentColor" />
    </svg>
  );
}

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.eyeIconSvg}>
        <path d="M12 5c5.18 0 9.45 3.42 10.7 8.13a1.76 1.76 0 0 1 0 .74C21.45 18.58 17.18 22 12 22s-9.45-3.42-10.7-8.13a1.76 1.76 0 0 1 0-.74C2.55 8.42 6.82 5 12 5Zm0 1.5c-4.5 0-8.25 2.91-9.26 7 1.01 4.09 4.76 7 9.26 7s8.25-2.91 9.26-7c-1.01-4.09-4.76-7-9.26-7Zm0 2.25A4.75 4.75 0 1 1 7.25 13.5 4.75 4.75 0 0 1 12 8.75Zm0 1.5A3.25 3.25 0 1 0 15.25 13.5 3.25 3.25 0 0 0 12 10.25Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.eyeIconSvg}>
      <path d="m4.53 3.47 16 16-1.06 1.06-2.54-2.54A11.36 11.36 0 0 1 12 19c-5.18 0-9.45-3.42-10.7-8.13a1.76 1.76 0 0 1 0-.74A11.49 11.49 0 0 1 6.06 4.7L3.47 2.12l1.06-1.06Zm6.11 6.11a3.25 3.25 0 0 0 3.78 3.78Zm7.87 7.87-2.74-2.74a4.75 4.75 0 0 0-6.48-6.48L7.14 6.08A9.69 9.69 0 0 0 2.74 10.5c1.01 4.09 4.76 7 9.26 7 2.26 0 4.34-.74 6.01-2.05Zm3.19-6.58a11.35 11.35 0 0 1-2.97 4.56l-1.07-1.07a9.56 9.56 0 0 0 3.6-3.86c-1.01-4.09-4.76-7-9.26-7-1.37 0-2.68.27-3.88.76L6.91 3.03A11.47 11.47 0 0 1 12 2c5.18 0 9.45 3.42 10.7 8.13a1.76 1.76 0 0 1 0 .74Z" fill="currentColor" />
    </svg>
  );
}

function DoopifyMark() {
  return (
    <div className={styles.logoBadge} aria-hidden="true">
      <span className={styles.logoGlyph}>D</span>
      <span className={styles.logoHalo} />
    </div>
  );
}

export default function LoginPortal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeField, setActiveField] = useState(null);
  const [tiltStyle, setTiltStyle] = useState({ '--rotate-x': '0deg', '--rotate-y': '0deg' });

  const nextPath = searchParams.get('next') || '/orders';
  const isReady = useMemo(() => email.trim().length > 0 && password.trim().length > 0, [email, password]);

  useEffect(() => {
    router.prefetch(nextPath);
  }, [nextPath, router]);

  const handleMouseMove = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - rect.left - rect.width / 2;
    const offsetY = event.clientY - rect.top - rect.height / 2;
    const rotateY = Math.max(-8, Math.min(8, (offsetX / rect.width) * 16));
    const rotateX = Math.max(-8, Math.min(8, (-offsetY / rect.height) * 16));

    setTiltStyle({
      '--rotate-x': `${rotateX.toFixed(2)}deg`,
      '--rotate-y': `${rotateY.toFixed(2)}deg`,
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({ '--rotate-x': '0deg', '--rotate-y': '0deg' });
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (!isReady || isLoading) return;

    setErrorMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorMessage(payload?.error || 'Sign-in failed. Check your credentials and try again.');
        setIsLoading(false);
        return;
      }

      window.location.assign(nextPath);
    } catch {
      setErrorMessage('Unable to reach the sign-in service right now. Try again in a sec.');
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.pageShell}>
      <div className={styles.noiseLayer} />
      <div className={styles.topGlow} />
      <div className={styles.bottomGlow} />
      <div className={styles.sideGlowLeft} />
      <div className={styles.sideGlowRight} />

      <section className={styles.portalFrame}>
        <div className={styles.portalCopy}>
          <div className={styles.eyebrow}>Phase 17 secure access direction</div>
          <h1 className={styles.portalTitle}>Private commerce operations for one store, one team, one clean command center.</h1>
          <p className={styles.portalText}>
            This login portal should feel premium and modern, but still trustworthy enough for daily store ops, payments, and staff access.
          </p>
          <div className={styles.securityPills}>
            {SECURITY_NOTES.map(note => (
              <span key={note} className={styles.securityPill}>
                {note}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.cardStage}>
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
                  <h2 className={styles.cardTitle}>Welcome back</h2>
                  <p className={styles.cardSubtitle}>Sign in to your private Doopify admin workspace.</p>
                </div>
              </div>

              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.fieldStack}>
                  <label className={`${styles.field} ${activeField === 'email' ? styles.fieldActive : ''}`}>
                    <span className={styles.inputIcon}><MailIcon /></span>
                    <input
                      type="email"
                      value={email}
                      onChange={event => {
                        setEmail(event.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      onFocus={() => setActiveField('email')}
                      onBlur={() => setActiveField(null)}
                      placeholder="Email address"
                      className={styles.input}
                    />
                  </label>

                  <label className={`${styles.field} ${activeField === 'password' ? styles.fieldActive : ''}`}>
                    <span className={styles.inputIcon}><LockIcon /></span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={event => {
                        setPassword(event.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      onFocus={() => setActiveField('password')}
                      onBlur={() => setActiveField(null)}
                      placeholder="Password"
                      className={styles.input}
                    />
                    <button
                      type="button"
                      className={styles.eyeButton}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(current => !current)}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </label>
                </div>

                <div className={styles.formMeta}>
                  <label className={styles.checkboxRow}>
                    <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(current => !current)} className={styles.checkbox} />
                    <span>Remember me</span>
                  </label>
                  <Link href="/forgot-password" className={styles.metaLink}>
                    Forgot password?
                  </Link>
                </div>

                {errorMessage ? <div className={styles.errorBanner}>{errorMessage}</div> : null}

                <button type="submit" disabled={!isReady || isLoading} className={styles.submitButton}>
                  <span className={styles.submitGlow} />
                  <span className={styles.submitInner}>
                    {isLoading ? <span className={styles.spinner} aria-hidden="true" /> : null}
                    <span>{isLoading ? 'Signing in…' : 'Sign in'}</span>
                    {!isLoading ? <span className={styles.arrow}>→</span> : null}
                  </span>
                </button>
              </form>

              <div className={styles.footerNote}>
                Authorized staff only · Secure store operations access · Stripe-ready private deployment
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
