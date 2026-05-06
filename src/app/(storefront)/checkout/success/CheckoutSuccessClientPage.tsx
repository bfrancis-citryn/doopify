"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useCart } from '@/context/CartContext';

type CheckoutStatus = 'processing' | 'paid' | 'failed'

type CheckoutStatusResponseData = {
  status: CheckoutStatus
  orderNumber?: number | string | null
  total?: number
  currency?: string
  estimatedDeliveryText?: string | null
  reason?: string
}

type PublicStoreSettings = {
  name?: string
  supportEmail?: string | null
  email?: string | null
  phone?: string | null
  secondaryColor?: string | null
  buttonStyle?: 'solid' | 'outline' | 'soft' | string | null
  buttonTextTransform?: 'uppercase' | 'none' | string | null
  buttonRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full' | string | null
  accentColor?: string | null
  primaryColor?: string | null
}

type ApiSuccess<TData> = {
  success: true
  data: TData
}

type ApiFailure = {
  success: false
  error?: string
}

type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure

type CartContextValue = {
  clearCart: () => void
}

const STATUS_POLL_INTERVAL_MS = 2000
const STATUS_WAIT_TIMEOUT_MS = 90000

function getApiErrorMessage<TData>(payload: ApiResponse<TData> | null, fallback: string): string {
  if (payload && !payload.success && payload.error) {
    return payload.error
  }

  return fallback
}

function formatMoney(amount: number | null | undefined, currency = 'USD'): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'USD').toUpperCase(),
  }).format(amount)
}

function parseHexColor(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  const match = /^#?([0-9a-fA-F]{6})$/.exec(normalized)
  if (!match) return null
  const hex = match[1]
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

function colorDistance(left: { r: number; g: number; b: number }, right: { r: number; g: number; b: number }) {
  return Math.abs(left.r - right.r) + Math.abs(left.g - right.g) + Math.abs(left.b - right.b)
}

function isNearCheckoutBackground(hexColor: string | null | undefined) {
  const color = parseHexColor(hexColor)
  const background = parseHexColor('#080808')
  if (!color || !background) return false
  return colorDistance(color, background) < 80
}

function isDarkColor(hexColor: string | null | undefined) {
  const color = parseHexColor(hexColor)
  if (!color) return false
  const luminance = (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255
  return luminance < 0.5
}

function resolveButtonPresentation(store: PublicStoreSettings | null) {
  const style = store?.buttonStyle || 'solid'
  const transform = store?.buttonTextTransform === 'uppercase' ? 'uppercase' : 'none'
  const radius = (() => {
    switch (store?.buttonRadius) {
      case 'none':
        return '0px'
      case 'sm':
        return '6px'
      case 'md':
        return '12px'
      case 'lg':
        return '18px'
      case 'full':
        return '9999px'
      default:
        return '9999px'
    }
  })()

  const accent = store?.accentColor || store?.primaryColor || '#c9a86c'
  const fallbackSurface = store?.secondaryColor || '#f3efe7'
  const solidBackground = isNearCheckoutBackground(accent) ? fallbackSurface : accent
  const solidText = isDarkColor(solidBackground) ? '#f3efe7' : '#080808'

  const primaryStyle =
    style === 'outline'
      ? {
          background: 'transparent',
          color: isNearCheckoutBackground(accent) ? '#f3efe7' : accent,
          border: `1px solid ${isNearCheckoutBackground(accent) ? '#f3efe7' : accent}`,
        }
      : style === 'soft'
        ? {
            background: `${isNearCheckoutBackground(accent) ? '#f3efe7' : accent}33`,
            color: '#f3efe7',
            border: `1px solid ${isNearCheckoutBackground(accent) ? '#f3efe7' : accent}66`,
          }
        : {
            background: solidBackground,
            color: solidText,
            border: 'none',
          }

  return { transform, radius, primaryStyle }
}

function buildPhoneHref(rawPhone: string) {
  const normalized = rawPhone.replace(/[^\d+]/g, '')
  if (!normalized) return ''
  return `tel:${normalized}`
}

function resolveSupportSummary(store: PublicStoreSettings | null) {
  const supportEmail = String(store?.supportEmail || store?.email || '').trim()
  const supportPhone = String(store?.phone || '').trim()

  if (!supportEmail && !supportPhone) {
    return {
      helpText: 'Contact the store for help with your order.',
      detailText: '',
      supportEmail: '',
      supportPhone: '',
      supportPhoneHref: '',
    }
  }

  const parts = [supportEmail, supportPhone].filter(Boolean)
  return {
    helpText: 'Contact the store for help with your order.',
    detailText: `Questions? Contact ${parts.join(' | ')}`,
    supportEmail,
    supportPhone,
    supportPhoneHref: buildPhoneHref(supportPhone),
  }
}
type ViewState = 'processing' | 'confirmed' | 'pending' | 'failed'

export default function CheckoutSuccessClientPage() {
  const searchParams = useSearchParams();
  const paymentIntentId = searchParams.get('payment_intent');
  const { clearCart } = useCart() as CartContextValue;

  const [status, setStatus] = useState<CheckoutStatus>('processing');
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [orderCurrency, setOrderCurrency] = useState('USD');
  const [estimatedDeliveryText, setEstimatedDeliveryText] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const [pollCycle, setPollCycle] = useState(0);
  const [store, setStore] = useState<PublicStoreSettings | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStoreSettings() {
      try {
        const response = await fetch('/api/storefront/settings', { cache: 'no-store' });
        const payload = (await response.json().catch(() => null)) as ApiResponse<PublicStoreSettings> | null;
        if (!response.ok || !payload?.success) return;
        if (!cancelled) setStore(payload.data || null);
      } catch {
        if (!cancelled) setStore(null);
      }
    }

    loadStoreSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const startedAt = Date.now();

    async function pollStatus() {
      if (!paymentIntentId) {
        setStatus('processing');
        return;
      }

      try {
        const response = await fetch(`/api/checkout/status?payment_intent=${encodeURIComponent(paymentIntentId)}`, {
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => null)) as ApiResponse<CheckoutStatusResponseData> | null;

        if (!response.ok || !payload?.success) {
          throw new Error(getApiErrorMessage(payload, 'We could not check your order status right now.'));
        }

        if (cancelled) return;

        const nextStatus = payload.data.status;
        setStatus(nextStatus);

        if (nextStatus === 'paid') {
          setOrderNumber(payload.data.orderNumber ? String(payload.data.orderNumber) : null);
          setOrderTotal(typeof payload.data.total === 'number' ? payload.data.total : null);
          setOrderCurrency(String(payload.data.currency || 'USD'));
          setEstimatedDeliveryText(String(payload.data.estimatedDeliveryText || '').trim());
          setFailureReason('');
          setPendingMessage('');
          setTimedOut(false);
          clearCart();
          return;
        }

        if (nextStatus === 'failed') {
          setFailureReason('Please return to checkout and try another payment method.');
          setPendingMessage('');
          setTimedOut(false);
          return;
        }

        if (Date.now() - startedAt >= STATUS_WAIT_TIMEOUT_MS) {
          setTimedOut(true);
          setPendingMessage('Your payment was submitted, but confirmation is taking longer than expected. You may receive your confirmation shortly.');
          return;
        }

        timer = window.setTimeout(pollStatus, STATUS_POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) {
          setTimedOut(true);
          setPendingMessage('Your payment was submitted, but confirmation is taking longer than expected. You may receive your confirmation shortly.');
        }
      }
    }

    pollStatus();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [clearCart, paymentIntentId, pollCycle]);

  const support = useMemo(() => resolveSupportSummary(store), [store]);
  const buttonPresentation = useMemo(() => resolveButtonPresentation(store), [store]);
  const primaryActionStyle = useMemo(
    () => ({
      ...buttonPresentation.primaryStyle,
      borderRadius: buttonPresentation.radius,
      textTransform: buttonPresentation.transform,
    }),
    [buttonPresentation]
  );
  const viewState: ViewState =
    status === 'paid'
      ? 'confirmed'
      : status === 'failed'
        ? 'failed'
        : timedOut
          ? 'pending'
          : 'processing';

  function handleCheckAgain() {
    setTimedOut(false);
    setPendingMessage('');
    setPollCycle((current) => current + 1);
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box}
        .checkout-result-root{min-height:100vh;background:#080808;color:#f3efe7;font-family:var(--font-body),sans-serif;display:flex;align-items:center;justify-content:center;padding:28px}
        .checkout-result-shell{width:min(640px,100%);display:flex;flex-direction:column;gap:18px;align-items:center;text-align:center}
        .badge{font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.52)}
        .title{margin:0;font-family:var(--font-headline),sans-serif;font-size:clamp(34px,7vw,54px);line-height:0.96;letter-spacing:-0.04em}
        .body{margin:0;color:rgba(255,255,255,0.74);font-size:15px;line-height:1.75;max-width:58ch}
        .spinner{width:56px;height:56px;border-radius:999px;border:3px solid rgba(255,255,255,0.22);border-top-color:var(--store-primary,#c9a86c);animation:spin .9s linear infinite}
        .order-pill{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);font-size:12px;letter-spacing:.1em;text-transform:uppercase}
        .meta{display:flex;flex-direction:column;gap:8px;align-items:center}
        .actions{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:6px}
        .btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;border:none;cursor:pointer;font-family:inherit}
        .btn-primary{background:var(--store-primary,#c9a86c);color:#080808}
        .btn-secondary{background:transparent;color:#f3efe7;border:1px solid rgba(255,255,255,0.2)}
        .btn-tertiary{background:rgba(255,255,255,0.08);color:#f3efe7;border:1px solid rgba(255,255,255,0.12)}
        .support{font-size:15px;color:rgba(255,255,255,0.78)}
        .support-subtle{font-size:13px;color:rgba(255,255,255,0.62)}
        .support-links{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:4px}
        .support-link{display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.08);color:#f3efe7;font-size:14px;line-height:1;text-decoration:none}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="checkout-result-root">
        <div className="checkout-result-shell">
          {viewState === 'processing' ? (
            <>
              <div className="spinner" aria-hidden />
              <p className="badge">Order update</p>
              <h1 className="title">Processing your order</h1>
              <p className="body">
                We&apos;re confirming your payment and preparing your order. This usually only takes a few seconds.
              </p>
              <p className="support">Please don&apos;t close or refresh this page.</p>
            </>
          ) : null}

          {viewState === 'confirmed' ? (
            <>
              <p className="badge">Order received</p>
              <h1 className="title">Thank you for your order</h1>
              <p className="body">Your payment was successful and your order has been received.</p>
              <div className="meta">
                {orderNumber ? <div className="order-pill">Order #{orderNumber}</div> : null}
                {orderTotal != null ? (
                  <p className="support">Total: {formatMoney(orderTotal, orderCurrency)}</p>
                ) : null}
                <p className="support-subtle">
                  {estimatedDeliveryText || "We'll send a confirmation email with your next order updates shortly."}
                </p>
                <p className="support">{support.helpText}</p>
                {support.detailText ? <p className="support-subtle">{support.detailText}</p> : null}
                {support.supportEmail || support.supportPhone ? (
                  <div className="support-links">
                    {support.supportEmail ? (
                      <a className="support-link" href={`mailto:${support.supportEmail}`}>{support.supportEmail}</a>
                    ) : null}
                    {support.supportPhone && support.supportPhoneHref ? (
                      <a className="support-link" href={support.supportPhoneHref}>{support.supportPhone}</a>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="actions">
                <Link className="btn btn-primary" href="/shop" style={primaryActionStyle}>Continue shopping</Link>
              </div>
            </>
          ) : null}

          {viewState === 'pending' ? (
            <>
              <p className="badge">Still working</p>
              <h1 className="title">We&apos;re still processing your order</h1>
              <p className="body">
                {pendingMessage || 'Your payment was submitted, but confirmation is taking longer than expected. You may receive your confirmation shortly.'}
              </p>
              <p className="support">{support.helpText}</p>
              <div className="actions">
                <button className="btn btn-primary" onClick={handleCheckAgain} style={primaryActionStyle} type="button">Check again</button>
                <Link className="btn btn-secondary" href="/shop">Continue shopping</Link>
                {support.supportEmail ? (
                  <a className="btn btn-tertiary" href={`mailto:${support.supportEmail}`}>Contact support</a>
                ) : null}
              </div>
            </>
          ) : null}

          {viewState === 'failed' ? (
            <>
              <p className="badge">Payment issue</p>
              <h1 className="title">Payment could not be completed</h1>
              <p className="body">{failureReason || 'Please return to checkout and try another payment method.'}</p>
              <div className="actions">
                <Link className="btn btn-primary" href="/checkout" style={primaryActionStyle}>Return to checkout</Link>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

