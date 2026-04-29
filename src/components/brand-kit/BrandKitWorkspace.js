"use client";

import { useEffect, useMemo, useState } from 'react';

import AppShell from '@/components/AppShell';
import {
  BRAND_FONT_VALUES,
  BUTTON_RADIUS_VALUES,
  BUTTON_STYLE_VALUES,
  BUTTON_TEXT_TRANSFORM_VALUES,
} from '@/lib/brand-kit';

import styles from './BrandKitWorkspace.module.css';

const COLOR_FIELDS = [
  ['primaryColor', 'Primary color'],
  ['secondaryColor', 'Secondary color'],
  ['accentColor', 'Accent color'],
  ['textColor', 'Text color'],
  ['emailHeaderColor', 'Email header color'],
];

const URL_FIELDS = [
  ['logoUrl', 'Store logo URL'],
  ['faviconUrl', 'Favicon URL'],
  ['emailLogoUrl', 'Email logo URL'],
  ['checkoutLogoUrl', 'Checkout logo URL'],
];

const SOCIAL_FIELDS = [
  ['instagramUrl', 'Instagram URL'],
  ['facebookUrl', 'Facebook URL'],
  ['tiktokUrl', 'TikTok URL'],
  ['youtubeUrl', 'YouTube URL'],
];

function normalizePatchValue(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

function computeButtonRadius(radius) {
  switch (radius) {
    case 'none':
      return '0px';
    case 'sm':
      return '6px';
    case 'md':
      return '12px';
    case 'lg':
      return '18px';
    case 'full':
      return '9999px';
    default:
      return '12px';
  }
}

function computeFontStack(font) {
  switch (font) {
    case 'inter':
      return '"Inter", system-ui, sans-serif';
    case 'arial':
      return 'Arial, sans-serif';
    case 'helvetica':
      return '"Helvetica Neue", Helvetica, Arial, sans-serif';
    case 'georgia':
      return 'Georgia, serif';
    case 'times':
      return '"Times New Roman", Times, serif';
    case 'poppins':
      return '"Poppins", "Inter", sans-serif';
    case 'montserrat':
      return '"Montserrat", "Inter", sans-serif';
    default:
      return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  }
}

function Field({ label, children }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function BrandKitWorkspace() {
  const [brandKit, setBrandKit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadBrandKit() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/settings/brand-kit', { cache: 'no-store' });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to load brand kit');
        }

        if (!cancelled) {
          setBrandKit(payload.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load brand kit');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadBrandKit();

    return () => {
      cancelled = true;
    };
  }, []);

  const preview = useMemo(() => {
    if (!brandKit) return null;

    const primary = brandKit.primaryColor || '#000000';
    const secondary = brandKit.secondaryColor || '#ffffff';
    const accent = brandKit.accentColor || primary;
    const textColor = brandKit.textColor || '#111111';
    const headingFont = computeFontStack(brandKit.headingFont);
    const bodyFont = computeFontStack(brandKit.bodyFont);
    const radius = computeButtonRadius(brandKit.buttonRadius);
    const transform = brandKit.buttonTextTransform === 'uppercase' ? 'uppercase' : 'none';

    return { primary, secondary, accent, textColor, headingFont, bodyFont, radius, transform };
  }, [brandKit]);

  function updateField(field, value) {
    setBrandKit((current) => ({ ...(current || {}), [field]: value }));
  }

  async function handleSave() {
    if (!brandKit) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const patch = Object.fromEntries(
        Object.entries(brandKit).map(([key, value]) => [key, normalizePatchValue(value)])
      );
      const response = await fetch('/api/settings/brand-kit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        const details = payload?.details?.fieldErrors
          ? JSON.stringify(payload.details.fieldErrors)
          : payload?.error;
        throw new Error(details || 'Failed to save brand kit');
      }

      setBrandKit(payload.data);
      setMessage('Brand kit saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save brand kit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell searchPlaceholder="Search settings">
      <div className={styles.pageWrap}>
        <section className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Brand Kit</h1>
            <p className={styles.pageSubtitle}>
              Configure storefront, checkout, and email branding from one screen.
            </p>
          </div>
          <button
            className={styles.primaryButton}
            onClick={handleSave}
            disabled={saving || loading}
            type="button"
          >
            {saving ? 'Saving...' : 'Save Brand Kit'}
          </button>
        </section>

        {message ? (
          <div className={styles.statusBlock}>
            <p className={styles.successText}>{message}</p>
          </div>
        ) : null}
        {error ? (
          <div className={styles.statusBlock}>
            <p className={styles.errorText}>{error}</p>
          </div>
        ) : null}

        {loading || !brandKit ? (
          <section className={styles.configSection}>Loading brand kit...</section>
        ) : (
          <div className={styles.configStack}>
            <section className={styles.configSection}>
              <h2 className={styles.sectionTitle}>1. Logo & Identity</h2>
              <Field label="Store name">
                <input
                  className={styles.input}
                  value={brandKit.name || ''}
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </Field>
              <div className={styles.formGrid}>
                {URL_FIELDS.map(([field, label]) => (
                  <Field key={field} label={label}>
                    <input
                      className={styles.input}
                      value={brandKit[field] || ''}
                      onChange={(event) => updateField(field, event.target.value)}
                      placeholder="https://..."
                    />
                  </Field>
                ))}
              </div>
            </section>

            <section className={styles.configSection}>
              <h2 className={styles.sectionTitle}>2. Colors</h2>
              <div className={styles.formGrid}>
                {COLOR_FIELDS.map(([field, label]) => (
                  <Field key={field} label={label}>
                    <div className={styles.colorRow}>
                      <input
                        className={styles.colorInput}
                        type="color"
                        value={brandKit[field] || '#000000'}
                        onChange={(event) => updateField(field, event.target.value)}
                      />
                      <input
                        className={styles.input}
                        value={brandKit[field] || ''}
                        onChange={(event) => updateField(field, event.target.value)}
                        placeholder="#000000"
                      />
                    </div>
                  </Field>
                ))}
              </div>
            </section>

            <section className={styles.configSection}>
              <h2 className={styles.sectionTitle}>3. Fonts</h2>
              <div className={styles.formGrid}>
                <Field label="Heading font">
                  <select
                    className={styles.selectInput}
                    value={brandKit.headingFont || 'system'}
                    onChange={(event) => updateField('headingFont', event.target.value)}
                  >
                    {BRAND_FONT_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Body font">
                  <select
                    className={styles.selectInput}
                    value={brandKit.bodyFont || 'system'}
                    onChange={(event) => updateField('bodyFont', event.target.value)}
                  >
                    {BRAND_FONT_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <section className={styles.configSection}>
              <h2 className={styles.sectionTitle}>4. Buttons</h2>
              <div className={styles.formGrid}>
                <Field label="Button radius">
                  <select
                    className={styles.selectInput}
                    value={brandKit.buttonRadius || 'md'}
                    onChange={(event) => updateField('buttonRadius', event.target.value)}
                  >
                    {BUTTON_RADIUS_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Button style">
                  <select
                    className={styles.selectInput}
                    value={brandKit.buttonStyle || 'solid'}
                    onChange={(event) => updateField('buttonStyle', event.target.value)}
                  >
                    {BUTTON_STYLE_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Button text transform">
                  <select
                    className={styles.selectInput}
                    value={brandKit.buttonTextTransform || 'normal'}
                    onChange={(event) => updateField('buttonTextTransform', event.target.value)}
                  >
                    {BUTTON_TEXT_TRANSFORM_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <section className={styles.configSection}>
              <h2 className={styles.sectionTitle}>5. Email Branding</h2>
              <Field label="Email footer text">
                <input
                  className={styles.input}
                  value={brandKit.emailFooterText || ''}
                  onChange={(event) => updateField('emailFooterText', event.target.value)}
                />
              </Field>
              <Field label="Support email">
                <input
                  className={styles.input}
                  value={brandKit.supportEmail || ''}
                  onChange={(event) => updateField('supportEmail', event.target.value)}
                />
              </Field>
            </section>

            <section className={styles.configSection}>
              <h2 className={styles.sectionTitle}>6. Checkout Branding</h2>
              <Field label="Checkout logo URL">
                <input
                  className={styles.input}
                  value={brandKit.checkoutLogoUrl || ''}
                  onChange={(event) => updateField('checkoutLogoUrl', event.target.value)}
                  placeholder="https://..."
                />
              </Field>
            </section>

            <section className={styles.configSection}>
              <h2 className={styles.sectionTitle}>7. Social Links</h2>
              <div className={styles.formGrid}>
                {SOCIAL_FIELDS.map(([field, label]) => (
                  <Field key={field} label={label}>
                    <input
                      className={styles.input}
                      value={brandKit[field] || ''}
                      onChange={(event) => updateField(field, event.target.value)}
                      placeholder="https://..."
                    />
                  </Field>
                ))}
              </div>
            </section>

            <section className={styles.configSection}>
              <h2 className={styles.sectionTitle}>Preview</h2>
              {preview ? (
                <div className={styles.previewCard}>
                  <div
                    className={styles.previewHeader}
                    style={{ background: preview.primary, color: preview.secondary, fontFamily: preview.headingFont }}
                  >
                    <span>{brandKit.name || 'Doopify'}</span>
                    <span>{brandKit.supportEmail || 'support@example.com'}</span>
                  </div>
                  <div
                    className={styles.previewBody}
                    style={{ color: preview.textColor, background: '#fff', fontFamily: preview.bodyFont }}
                  >
                    {brandKit.logoUrl || brandKit.checkoutLogoUrl ? (
                      <img
                        src={brandKit.logoUrl || brandKit.checkoutLogoUrl}
                        alt="Brand logo preview"
                        className={styles.previewLogo}
                      />
                    ) : null}
                    <h3 className={styles.previewHeading} style={{ fontFamily: preview.headingFont }}>
                      Sample heading
                    </h3>
                    <p className={styles.previewParagraph}>
                      This preview demonstrates storefront typography, button tone, and email header styling.
                    </p>
                    <div className={styles.previewButtons}>
                      <button
                        type="button"
                        style={{
                          borderRadius: preview.radius,
                          padding: '10px 14px',
                          textTransform: preview.transform,
                          border: brandKit.buttonStyle === 'outline' ? `1px solid ${preview.accent}` : 'none',
                          background:
                            brandKit.buttonStyle === 'outline'
                              ? 'transparent'
                              : brandKit.buttonStyle === 'soft'
                                ? `${preview.accent}22`
                                : preview.accent,
                          color: brandKit.buttonStyle === 'outline' ? preview.accent : '#111827',
                        }}
                      >
                        Primary button
                      </button>
                      <button
                        type="button"
                        style={{
                          borderRadius: preview.radius,
                          padding: '10px 14px',
                          textTransform: preview.transform,
                          border: `1px solid ${preview.primary}`,
                          background: 'transparent',
                          color: preview.primary,
                        }}
                      >
                        Secondary button
                      </button>
                    </div>
                  </div>
                  <div className={styles.previewFooter}>
                    {brandKit.emailFooterText || 'Thanks for choosing our store.'}
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
