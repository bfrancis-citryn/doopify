"use client";

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useCart } from '@/context/CartContext';

const EMPTY_ADDRESS = {
  firstName: '',
  lastName: '',
  company: '',
  address1: '',
  address2: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'US',
  phone: '',
};

function loadStripeJs() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Stripe.js can only load in the browser'))
  }

  if (window.Stripe) {
    return Promise.resolve(window.Stripe)
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-stripe-js="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Stripe))
      existing.addEventListener('error', () => reject(new Error('Failed to load Stripe.js')))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://js.stripe.com/v3/'
    script.async = true
    script.dataset.stripeJs = 'true'
    script.onload = () => resolve(window.Stripe)
    script.onerror = () => reject(new Error('Failed to load Stripe.js'))
    document.head.appendChild(script)
  })
}

function formatMoney(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount || 0)
}

function buildAddressPayload(address) {
  return {
    firstName: address.firstName.trim(),
    lastName: address.lastName.trim(),
    company: address.company.trim() || undefined,
    address1: address.address1.trim(),
    address2: address.address2.trim() || undefined,
    city: address.city.trim(),
    province: address.province.trim() || undefined,
    postalCode: address.postalCode.trim(),
    country: address.country.trim(),
    phone: address.phone.trim() || undefined,
  }
}

function isAddressComplete(address) {
  return (
    address.firstName.trim() &&
    address.lastName.trim() &&
    address.address1.trim() &&
    address.city.trim() &&
    address.postalCode.trim() &&
    address.country.trim()
  )
}

export default function CheckoutClientPage({ publishableKey, store }) {
  const router = useRouter();
  const { items, total: cartSubtotal } = useCart();
  const [email, setEmail] = useState('');
  const [shippingAddress, setShippingAddress] = useState(EMPTY_ADDRESS);
  const [billingAddress, setBillingAddress] = useState(EMPTY_ADDRESS);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [checkout, setCheckout] = useState(null);
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [error, setError] = useState('');
  const [paymentReady, setPaymentReady] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountError, setDiscountError] = useState('');

  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const paymentElementRef = useRef(null);

  const currency = checkout?.currency || store?.currency || 'USD';
  const lineCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  function resetPaymentStep() {
    if (paymentElementRef.current) {
      paymentElementRef.current.unmount();
      paymentElementRef.current = null;
    }

    stripeRef.current = null;
    elementsRef.current = null;
    setCheckout(null);
    setPaymentReady(false);
  }

  function updateShippingField(field, value) {
    if (checkout) resetPaymentStep();
    setShippingAddress((current) => ({ ...current, [field]: value }));
  }

  function updateBillingField(field, value) {
    if (checkout) resetPaymentStep();
    setBillingAddress((current) => ({ ...current, [field]: value }));
  }

  async function initializePaymentElement(clientSecret) {
    const StripeConstructor = await loadStripeJs();
    if (!StripeConstructor) {
      throw new Error('Stripe.js was not available after loading')
    }

    const stripe = StripeConstructor(publishableKey);
    if (!stripe) {
      throw new Error('Stripe could not be initialized with the publishable key')
    }

    const elements = stripe.elements({
      clientSecret,
      appearance: {
        theme: 'night',
        variables: {
          colorPrimary: store?.primaryColor || '#c9a86c',
          colorBackground: '#111114',
          colorText: '#f5f5f5',
          colorDanger: '#ef4444',
          borderRadius: '16px',
        },
      },
    });

    const paymentElement = elements.create('payment', {
      layout: 'accordion',
    });

    paymentElement.mount('#payment-element');
    stripeRef.current = stripe;
    elementsRef.current = elements;
    paymentElementRef.current = paymentElement;
    setPaymentReady(true);
  }

  async function handleCreateIntent(event) {
    event.preventDefault();
    setError('');
    setDiscountError('');

    if (!publishableKey) {
      setError('Stripe is not configured yet. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to continue.');
      return;
    }

    if (!items.length) {
      setError('Your cart is empty.');
      return;
    }

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    if (!isAddressComplete(shippingAddress)) {
      setError('Please complete the shipping address before continuing.');
      return;
    }

    if (!billingSameAsShipping && !isAddressComplete(billingAddress)) {
      setError('Please complete the billing address before continuing.');
      return;
    }

    setCreatingIntent(true);

    try {
      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          items: items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          shippingAddress: buildAddressPayload(shippingAddress),
          billingAddress: billingSameAsShipping ? buildAddressPayload(shippingAddress) : buildAddressPayload(billingAddress),
          ...(showDiscount && discountCode.trim() ? { discountCode: discountCode.trim() } : {}),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to start checkout');
      }

      setCheckout(payload.data);
      await initializePaymentElement(payload.data.clientSecret);
    } catch (checkoutError) {
      const message = checkoutError instanceof Error ? checkoutError.message : 'Failed to start checkout';
      if (message.toLowerCase().includes('discount')) {
        setDiscountError(message);
      } else {
        setError(message);
      }
    } finally {
      setCreatingIntent(false);
    }
  }

  async function handlePlaceOrder(event) {
    event.preventDefault();
    setError('');

    if (!checkout?.clientSecret || !stripeRef.current || !elementsRef.current) {
      setError('Review payment first so we can load the secure payment form.');
      return;
    }

    setConfirmingPayment(true);

    try {
      const result = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        clientSecret: checkout.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success`,
        },
        redirect: 'if_required',
      });

      if (result.error) {
        throw new Error(result.error.message || 'Payment confirmation failed');
      }

      if (result.paymentIntent?.id) {
        router.push(`/checkout/success?payment_intent=${encodeURIComponent(result.paymentIntent.id)}`);
      } else {
        router.push('/checkout/success');
      }
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Payment confirmation failed');
    } finally {
      setConfirmingPayment(false);
    }
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box}
        .checkout-root{min-height:100vh;background:#080808;color:#f3efe7;font-family:var(--font-body),sans-serif}
        .checkout-nav{display:flex;align-items:center;justify-content:space-between;padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.08)}
        .checkout-logo{color:#f3efe7;text-decoration:none;font-family:var(--font-headline),sans-serif;font-size:20px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase}
        .checkout-shell{max-width:1280px;margin:0 auto;padding:40px 32px 80px;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,0.75fr);gap:32px}
        .checkout-card{padding:28px;border-radius:28px;border:1px solid rgba(255,255,255,0.09);background:linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025)),rgba(255,255,255,0.02);box-shadow:inset 0 1px 0 rgba(255,255,255,0.08),0 22px 46px rgba(0,0,0,0.22)}
        .eyebrow{font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(255,255,255,0.38);margin-bottom:10px}
        .title{font-family:var(--font-headline),sans-serif;font-size:46px;line-height:0.96;letter-spacing:-0.05em;margin:0 0 14px}
        .lede{font-size:15px;line-height:1.7;color:rgba(255,255,255,0.6);margin:0 0 32px}
        .section{margin-top:28px}
        .section-title{font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.44);margin-bottom:16px}
        .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
        .field{display:flex;flex-direction:column;gap:8px}
        .field span{font-size:12px;color:rgba(255,255,255,0.56)}
        .field input{width:100%;padding:14px 16px;border-radius:16px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#f3efe7;font:inherit}
        .field input:focus{outline:none;border-color:rgba(255,255,255,0.22);background:rgba(255,255,255,0.06)}
        .full{grid-column:1 / -1}
        .checkbox{display:flex;align-items:center;gap:12px;margin-top:18px;font-size:14px;color:rgba(255,255,255,0.7)}
        .checkbox input{accent-color:var(--store-primary)}
        .cta-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}
        .primary-btn,.secondary-btn{min-height:48px;padding:0 20px;border-radius:999px;border:none;font:inherit;font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;cursor:pointer}
        .primary-btn{background:var(--store-primary);color:#080808}
        .secondary-btn{background:transparent;border:1px solid rgba(255,255,255,0.14);color:#f3efe7}
        .primary-btn:disabled,.secondary-btn:disabled{opacity:0.55;cursor:not-allowed}
        .error{margin-top:18px;padding:14px 16px;border-radius:16px;border:1px solid rgba(239,68,68,0.4);background:rgba(127,29,29,0.25);color:#fecaca;font-size:14px}
        .payment-shell{margin-top:24px;padding:20px;border-radius:22px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03)}
        .summary-list{display:flex;flex-direction:column;gap:18px}
        .summary-item{display:flex;gap:14px}
        .summary-thumb{width:76px;height:76px;border-radius:18px;background:rgba(255,255,255,0.05);overflow:hidden;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.22)}
        .summary-thumb img{width:100%;height:100%;object-fit:cover}
        .summary-meta{flex:1;min-width:0}
        .summary-title{font-size:15px;color:#f3efe7;margin:0 0 6px}
        .summary-variant{font-size:12px;color:rgba(255,255,255,0.44);margin:0 0 6px}
        .summary-qty{font-size:12px;color:rgba(255,255,255,0.52)}
        .summary-price{font-size:14px;color:#f3efe7;white-space:nowrap}
        .summary-divider{height:1px;background:rgba(255,255,255,0.08);margin:22px 0}
        .summary-row{display:flex;align-items:center;justify-content:space-between;font-size:14px;color:rgba(255,255,255,0.66);margin-bottom:12px}
        .summary-row.total{font-size:18px;color:#f3efe7;font-weight:600;margin-top:12px}
        .empty-state{display:flex;flex-direction:column;align-items:flex-start;gap:14px}
        .empty-state a{color:#f3efe7}
        @media (max-width:960px){.checkout-shell{grid-template-columns:1fr}.checkout-card.summary{order:-1}}
        @media (max-width:640px){.checkout-shell{padding:28px 18px 64px}.checkout-nav{padding:20px 18px}.grid{grid-template-columns:1fr}.title{font-size:36px}}
      `}</style>

      <div className="checkout-root">
        <nav className="checkout-nav">
          <Link className="checkout-logo" href="/">{store?.name || 'Doopify'}</Link>
          <Link style={{ color: 'rgba(255,255,255,0.58)', textDecoration: 'none', fontSize: 13 }} href="/shop">
            Continue shopping
          </Link>
        </nav>

        <div className="checkout-shell">
          <form className="checkout-card" onSubmit={paymentReady ? handlePlaceOrder : handleCreateIntent}>
            <p className="eyebrow">Secure checkout</p>
            <h1 className="title">Finish the purchase flow.</h1>
            <p className="lede">
              Real cart items, real inventory checks, and payment completion backed by the Stripe webhook path.
            </p>

            {!items.length ? (
              <div className="empty-state">
                <p>Your cart is empty right now.</p>
                <Link href="/shop">Return to the shop</Link>
              </div>
            ) : (
              <>
                <div className="section">
                  <div className="section-title">Contact</div>
                  <div className="grid">
                    <label className="field full">
                      <span>Email</span>
                      <input
                        onChange={(event) => {
                          if (checkout) resetPaymentStep();
                          setEmail(event.target.value);
                        }}
                        placeholder="you@example.com"
                        type="email"
                        value={email}
                      />
                    </label>
                  </div>
                </div>

                <div className="section">
                  <div className="section-title">Shipping address</div>
                  <div className="grid">
                    <label className="field">
                      <span>First name</span>
                      <input value={shippingAddress.firstName} onChange={(event) => updateShippingField('firstName', event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Last name</span>
                      <input value={shippingAddress.lastName} onChange={(event) => updateShippingField('lastName', event.target.value)} />
                    </label>
                    <label className="field full">
                      <span>Company</span>
                      <input value={shippingAddress.company} onChange={(event) => updateShippingField('company', event.target.value)} />
                    </label>
                    <label className="field full">
                      <span>Address line 1</span>
                      <input value={shippingAddress.address1} onChange={(event) => updateShippingField('address1', event.target.value)} />
                    </label>
                    <label className="field full">
                      <span>Address line 2</span>
                      <input value={shippingAddress.address2} onChange={(event) => updateShippingField('address2', event.target.value)} />
                    </label>
                    <label className="field">
                      <span>City</span>
                      <input value={shippingAddress.city} onChange={(event) => updateShippingField('city', event.target.value)} />
                    </label>
                    <label className="field">
                      <span>State / Province</span>
                      <input value={shippingAddress.province} onChange={(event) => updateShippingField('province', event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Postal code</span>
                      <input value={shippingAddress.postalCode} onChange={(event) => updateShippingField('postalCode', event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Country</span>
                      <input value={shippingAddress.country} onChange={(event) => updateShippingField('country', event.target.value)} />
                    </label>
                    <label className="field full">
                      <span>Phone</span>
                      <input value={shippingAddress.phone} onChange={(event) => updateShippingField('phone', event.target.value)} />
                    </label>
                  </div>

                  <label className="checkbox">
                    <input
                      checked={billingSameAsShipping}
                      onChange={(event) => {
                        if (checkout) resetPaymentStep();
                        setBillingSameAsShipping(event.target.checked);
                      }}
                      type="checkbox"
                    />
                    Billing address is the same as shipping
                  </label>
                </div>

                {!billingSameAsShipping && (
                  <div className="section">
                    <div className="section-title">Billing address</div>
                    <div className="grid">
                      <label className="field">
                        <span>First name</span>
                        <input value={billingAddress.firstName} onChange={(event) => updateBillingField('firstName', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Last name</span>
                        <input value={billingAddress.lastName} onChange={(event) => updateBillingField('lastName', event.target.value)} />
                      </label>
                      <label className="field full">
                        <span>Address line 1</span>
                        <input value={billingAddress.address1} onChange={(event) => updateBillingField('address1', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>City</span>
                        <input value={billingAddress.city} onChange={(event) => updateBillingField('city', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>State / Province</span>
                        <input value={billingAddress.province} onChange={(event) => updateBillingField('province', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Postal code</span>
                        <input value={billingAddress.postalCode} onChange={(event) => updateBillingField('postalCode', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Country</span>
                        <input value={billingAddress.country} onChange={(event) => updateBillingField('country', event.target.value)} />
                      </label>
                    </div>
                  </div>
                )}

                <div className="section">
                  {showDiscount ? (
                    <>
                      <div className="section-title">Promo code</div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input
                          className="field"
                          onChange={e => {
                            if (checkout) resetPaymentStep();
                            setDiscountCode(e.target.value.toUpperCase());
                            setDiscountError('');
                          }}
                          placeholder="ENTER CODE"
                          style={{ flex: 1, padding: '13px 16px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#f3efe7', fontFamily: 'inherit', fontSize: 13, letterSpacing: '0.08em' }}
                          type="text"
                          value={discountCode}
                        />
                        <button
                          className="secondary-btn"
                          onClick={() => { setShowDiscount(false); setDiscountCode(''); setDiscountError(''); if (checkout) resetPaymentStep(); }}
                          style={{ padding: '0 16px', minHeight: 44, flexShrink: 0 }}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                      {discountError ? (
                        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 12, background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5', fontSize: 13 }}>
                          {discountError}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <button
                      className="secondary-btn"
                      onClick={() => setShowDiscount(true)}
                      style={{ fontSize: 12, minHeight: 38, padding: '0 14px' }}
                      type="button"
                    >
                      + Add promo code
                    </button>
                  )}
                </div>

                {checkout && (
                  <div className="payment-shell">
                    <div className="section-title" style={{ marginBottom: 12 }}>Payment</div>
                    <div id="payment-element" />
                  </div>
                )}

                <div className="cta-row">
                  {!paymentReady ? (
                    <button className="primary-btn" disabled={creatingIntent || !items.length} type="submit">
                      {creatingIntent ? 'Loading payment...' : 'Review payment'}
                    </button>
                  ) : (
                    <>
                      <button className="primary-btn" disabled={confirmingPayment} type="submit">
                        {confirmingPayment ? 'Placing order...' : 'Place order'}
                      </button>
                      <button
                        className="secondary-btn"
                        disabled={confirmingPayment}
                        onClick={(event) => {
                          event.preventDefault();
                          resetPaymentStep();
                        }}
                        type="button"
                      >
                        Edit details
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {error ? (
              <div className="error" role="alert">
                <strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>
                  {error.toLowerCase().includes('units left') ? 'Stock issue' :
                   error.toLowerCase().includes('variant') ? 'Item unavailable' :
                   'Could not start checkout'}
                </strong>
                {error}
              </div>
            ) : null}
          </form>

          <aside className="checkout-card summary">
            <p className="eyebrow">Order summary</p>
            <h2 style={{ margin: '0 0 6px', fontSize: 26, fontFamily: 'var(--font-headline), sans-serif' }}>
              {lineCount} item{lineCount === 1 ? '' : 's'} ready to go
            </h2>
            <p style={{ margin: '0 0 28px', color: 'rgba(255,255,255,0.56)', lineHeight: 1.7 }}>
              Prices are validated against live product data when you create the payment intent.
            </p>

            <div className="summary-list">
              {items.map((item) => (
                <div className="summary-item" key={item.variantId}>
                  <div className="summary-thumb">
                    {item.image ? <img alt={item.title} src={item.image} /> : <span>+</span>}
                  </div>
                  <div className="summary-meta">
                    <p className="summary-title">{item.title}</p>
                    {item.variantTitle ? <p className="summary-variant">{item.variantTitle}</p> : null}
                    <p className="summary-qty">Qty {item.quantity}</p>
                  </div>
                  <div className="summary-price">{formatMoney(item.price * item.quantity, currency)}</div>
                </div>
              ))}
            </div>

            <div className="summary-divider" />

            <div className="summary-row">
              <span>Subtotal</span>
              <span>{formatMoney(checkout?.subtotal ?? cartSubtotal, currency)}</span>
            </div>
            <div className="summary-row">
              <span>Shipping</span>
              <span>{checkout ? formatMoney(checkout.shippingAmount, currency) : 'Calculated at payment step'}</span>
            </div>
            <div className="summary-row">
              <span>Tax</span>
              <span>{checkout ? formatMoney(checkout.taxAmount, currency) : 'Calculated at payment step'}</span>
            </div>
            {checkout && checkout.discountAmount > 0 ? (
              <div className="summary-row" style={{ color: '#86efac' }}>
                <span>Discount{checkout.discountApplications?.[0]?.code ? ` (${checkout.discountApplications[0].code})` : ''}</span>
                <span>-{formatMoney(checkout.discountAmount, currency)}</span>
              </div>
            ) : null}
            <div className="summary-row total">
              <span>Total</span>
              <span>{formatMoney(checkout?.total ?? cartSubtotal, currency)}</span>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
