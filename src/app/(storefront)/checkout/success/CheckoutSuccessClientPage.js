"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCart } from '@/context/CartContext';

export default function CheckoutSuccessClientPage() {
  const searchParams = useSearchParams();
  const paymentIntentId = searchParams.get('payment_intent');
  const { clearCart } = useCart();
  const [status, setStatus] = useState('processing');
  const [orderNumber, setOrderNumber] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function poll() {
      if (!paymentIntentId) {
        setStatus('processing');
        return;
      }

      try {
        const response = await fetch(`/api/checkout/status?payment_intent=${encodeURIComponent(paymentIntentId)}`, {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Unable to fetch order status');
        }

        if (cancelled) {
          return;
        }

        const nextStatus = payload.data.status;
        setStatus(nextStatus);

        if (nextStatus === 'paid') {
          setOrderNumber(payload.data.orderNumber || null);
          clearCart();
          return;
        }

        if (nextStatus === 'failed') {
          setError(payload.data.reason || 'Payment failed.');
          return;
        }

        timer = window.setTimeout(poll, 2000);
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : 'Unable to confirm payment status yet.');
        }
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [clearCart, paymentIntentId]);

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box}
        .success-root{min-height:100vh;background:#080808;color:#f3efe7;font-family:var(--font-body),sans-serif;display:flex;align-items:center;justify-content:center;padding:32px}
        .success-card{max-width:620px;width:100%;padding:36px;border-radius:30px;border:1px solid rgba(255,255,255,0.09);background:linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025)),rgba(255,255,255,0.02);box-shadow:inset 0 1px 0 rgba(255,255,255,0.08),0 28px 70px rgba(0,0,0,0.28)}
        .eyebrow{font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(255,255,255,0.38);margin-bottom:10px}
        .title{margin:0 0 14px;font-family:var(--font-headline),sans-serif;font-size:42px;line-height:0.96;letter-spacing:-0.05em}
        .body{margin:0 0 26px;font-size:15px;line-height:1.8;color:rgba(255,255,255,0.64)}
        .pill{display:inline-flex;align-items:center;padding:10px 14px;border-radius:999px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#f3efe7}
        .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
        .actions a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:999px;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase}
        .primary{background:var(--store-primary);color:#080808}
        .secondary{border:1px solid rgba(255,255,255,0.14);color:#f3efe7}
      `}</style>

      <div className="success-root">
        <div className="success-card">
          <p className="eyebrow">Checkout status</p>
          {status === 'paid' ? (
            <>
              <h1 className="title">Order confirmed.</h1>
              <p className="body">
                Your payment cleared and the webhook finalized the order. {orderNumber ? `Order #${orderNumber} is ready.` : 'We have your purchase.'}
              </p>
              {orderNumber ? <div className="pill">Order #{orderNumber}</div> : null}
            </>
          ) : status === 'failed' ? (
            <>
              <h1 className="title">Payment didn&apos;t complete.</h1>
              <p className="body">{error || 'Stripe marked this payment as failed. You can head back to checkout and try again.'}</p>
            </>
          ) : (
            <>
              <h1 className="title">Finalizing your order.</h1>
              <p className="body">
                Payment was submitted, and we&apos;re waiting for the Stripe webhook to finish writing the order record.
                This usually takes a moment.
              </p>
              <div className="pill">Waiting for webhook confirmation</div>
            </>
          )}

          <div className="actions">
            <Link className="primary" href="/shop">Back to shop</Link>
            <Link className="secondary" href="/checkout">Return to checkout</Link>
          </div>
        </div>
      </div>
    </>
  );
}
