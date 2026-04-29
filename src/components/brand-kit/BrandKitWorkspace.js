"use client";

import { useEffect, useMemo, useState } from 'react';

import AppShell from '@/components/AppShell';
import {
  BRAND_FONT_VALUES,
  BUTTON_RADIUS_VALUES,
  BUTTON_STYLE_VALUES,
  BUTTON_TEXT_TRANSFORM_VALUES,
} from '@/lib/brand-kit';

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

function sectionStyle() {
  return {
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    padding: 16,
    background: '#fff',
    display: 'grid',
    gap: 12,
  };
}

function inputStyle() {
  return {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
  };
}

function labelStyle() {
  return {
    display: 'grid',
    gap: 6,
    fontSize: 13,
    color: '#374151',
  };
}

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
      <div style={{ display: 'grid', gap: 16 }}>
        <section style={{ ...sectionStyle(), gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>Brand Kit</h1>
            <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
              Configure storefront, checkout, and email branding from one screen.
            </p>
          </div>
          <button onClick={handleSave} disabled={saving || loading} type="button" style={{ padding: '10px 16px', borderRadius: 10, background: '#111827', color: '#fff' }}>
            {saving ? 'Saving…' : 'Save Brand Kit'}
          </button>
        </section>

        {message ? <p style={{ margin: 0, color: '#047857' }}>{message}</p> : null}
        {error ? <p style={{ margin: 0, color: '#b91c1c', whiteSpace: 'pre-wrap' }}>{error}</p> : null}

        {loading || !brandKit ? (
          <section style={sectionStyle()}>Loading brand kit…</section>
        ) : (
          <>
            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>1. Logo & Identity</h2>
              <label style={labelStyle()}>
                <span>Store name</span>
                <input style={inputStyle()} value={brandKit.name || ''} onChange={(event) => updateField('name', event.target.value)} />
              </label>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                {URL_FIELDS.map(([field, label]) => (
                  <label key={field} style={labelStyle()}>
                    <span>{label}</span>
                    <input style={inputStyle()} value={brandKit[field] || ''} onChange={(event) => updateField(field, event.target.value)} placeholder="https://..." />
                  </label>
                ))}
              </div>
            </section>

            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>2. Colors</h2>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {COLOR_FIELDS.map(([field, label]) => (
                  <label key={field} style={labelStyle()}>
                    <span>{label}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 8 }}>
                      <input type="color" value={brandKit[field] || '#000000'} onChange={(event) => updateField(field, event.target.value)} />
                      <input style={inputStyle()} value={brandKit[field] || ''} onChange={(event) => updateField(field, event.target.value)} placeholder="#000000" />
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>3. Fonts</h2>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <label style={labelStyle()}>
                  <span>Heading font</span>
                  <select style={inputStyle()} value={brandKit.headingFont || 'system'} onChange={(event) => updateField('headingFont', event.target.value)}>
                    {BRAND_FONT_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label style={labelStyle()}>
                  <span>Body font</span>
                  <select style={inputStyle()} value={brandKit.bodyFont || 'system'} onChange={(event) => updateField('bodyFont', event.target.value)}>
                    {BRAND_FONT_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>4. Buttons</h2>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <label style={labelStyle()}>
                  <span>Button radius</span>
                  <select style={inputStyle()} value={brandKit.buttonRadius || 'md'} onChange={(event) => updateField('buttonRadius', event.target.value)}>
                    {BUTTON_RADIUS_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label style={labelStyle()}>
                  <span>Button style</span>
                  <select style={inputStyle()} value={brandKit.buttonStyle || 'solid'} onChange={(event) => updateField('buttonStyle', event.target.value)}>
                    {BUTTON_STYLE_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label style={labelStyle()}>
                  <span>Button text transform</span>
                  <select style={inputStyle()} value={brandKit.buttonTextTransform || 'normal'} onChange={(event) => updateField('buttonTextTransform', event.target.value)}>
                    {BUTTON_TEXT_TRANSFORM_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>5. Email Branding</h2>
              <label style={labelStyle()}>
                <span>Email footer text</span>
                <input style={inputStyle()} value={brandKit.emailFooterText || ''} onChange={(event) => updateField('emailFooterText', event.target.value)} />
              </label>
              <label style={labelStyle()}>
                <span>Support email</span>
                <input style={inputStyle()} value={brandKit.supportEmail || ''} onChange={(event) => updateField('supportEmail', event.target.value)} />
              </label>
            </section>

            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>6. Checkout Branding</h2>
              <label style={labelStyle()}>
                <span>Checkout logo URL</span>
                <input style={inputStyle()} value={brandKit.checkoutLogoUrl || ''} onChange={(event) => updateField('checkoutLogoUrl', event.target.value)} />
              </label>
            </section>

            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>7. Social Links</h2>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {SOCIAL_FIELDS.map(([field, label]) => (
                  <label key={field} style={labelStyle()}>
                    <span>{label}</span>
                    <input style={inputStyle()} value={brandKit[field] || ''} onChange={(event) => updateField(field, event.target.value)} />
                  </label>
                ))}
              </div>
            </section>

            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Preview</h2>
              {preview ? (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ background: preview.primary, color: '#fff', padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: preview.headingFont }}>{brandKit.name || 'Doopify'}</span>
                    <span>{brandKit.supportEmail || 'support@example.com'}</span>
                  </div>
                  <div style={{ padding: 16, color: preview.textColor, background: '#fff', fontFamily: preview.bodyFont }}>
                    {(brandKit.logoUrl || brandKit.checkoutLogoUrl) ? (
                      <img src={brandKit.logoUrl || brandKit.checkoutLogoUrl} alt="Brand logo preview" style={{ height: 36, width: 'auto', marginBottom: 12 }} />
                    ) : null}
                    <h3 style={{ margin: '0 0 10px', fontFamily: preview.headingFont }}>Sample heading</h3>
                    <p style={{ margin: '0 0 14px' }}>
                      This preview demonstrates storefront typography, button tone, and email header styling.
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        style={{
                          borderRadius: preview.radius,
                          padding: '10px 14px',
                          textTransform: preview.transform,
                          border: brandKit.buttonStyle === 'outline' ? `1px solid ${preview.accent}` : 'none',
                          background: brandKit.buttonStyle === 'outline'
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
                  <div style={{ padding: 12, background: '#f9fafb', borderTop: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280' }}>
                    {brandKit.emailFooterText || 'Thanks for choosing our store.'}
                  </div>
                </div>
              ) : null}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
