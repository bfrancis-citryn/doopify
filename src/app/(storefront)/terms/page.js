import Link from 'next/link';
import { getPublicStorefrontSettings } from '@/server/services/settings.service';

export const metadata = {
  title: 'Doopify | Terms of Service',
  description: 'Terms and conditions for this Doopify storefront.',
};

function supportContact(store) {
  return store?.supportEmail || store?.email || null;
}

export default async function TermsPage() {
  const store = await getPublicStorefrontSettings().catch(() => null);
  const contact = supportContact(store);

  return (
    <main style={{ maxWidth: 840, margin: '0 auto', padding: '72px 24px', color: 'var(--brand-text, #f2ede4)' }}>
      <p style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>Legal</p>
      <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', margin: '12px 0 20px', lineHeight: 1.1 }}>Terms of Service</h1>
      <p style={{ opacity: 0.85, marginBottom: 18 }}>
        By placing an order, you agree to these terms, including pricing, payment authorization, fulfillment timing,
        and return/refund policies published by this store.
      </p>
      <h2 style={{ marginBottom: 8 }}>Orders and payment</h2>
      <p style={{ opacity: 0.85, marginBottom: 16 }}>
        All totals are calculated server-side at checkout. Orders are finalized only after verified payment confirmation.
      </p>
      <h2 style={{ marginBottom: 8 }}>Shipping and delivery</h2>
      <p style={{ opacity: 0.85, marginBottom: 16 }}>
        Delivery windows are estimates and may vary by destination and carrier availability.
      </p>
      <h2 style={{ marginBottom: 8 }}>Returns and refunds</h2>
      <p style={{ opacity: 0.85, marginBottom: 16 }}>
        Return and refund eligibility is determined by the store operator and applicable law.
      </p>
      <h2 style={{ marginBottom: 8 }}>Contact</h2>
      <p style={{ opacity: 0.85, marginBottom: 24 }}>
        Questions about these terms can be sent to {contact || 'the store operator'}.
      </p>
      <p>
        <Link href="/" style={{ color: 'var(--brand-secondary, #f2ede4)' }}>
          Return to storefront
        </Link>
      </p>
    </main>
  );
}
