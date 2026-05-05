import Link from 'next/link';
import { getPublicStorefrontSettings } from '@/server/services/settings.service';

export const metadata = {
  title: 'Doopify | Privacy Policy',
  description: 'Privacy information for this Doopify storefront.',
};

function formatContact(store) {
  const lines = [];
  if (store?.supportEmail || store?.email) lines.push(store.supportEmail || store.email);
  if (store?.phone) lines.push(store.phone);
  const location = [store?.address1, store?.address2, store?.city, store?.province, store?.postalCode, store?.country]
    .filter(Boolean)
    .join(', ');
  if (location) lines.push(location);
  return lines;
}

export default async function PrivacyPage() {
  const store = await getPublicStorefrontSettings().catch(() => null);
  const contactLines = formatContact(store);

  return (
    <main style={{ maxWidth: 840, margin: '0 auto', padding: '72px 24px', color: 'var(--brand-text, #f2ede4)' }}>
      <p style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>Legal</p>
      <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', margin: '12px 0 20px', lineHeight: 1.1 }}>Privacy Policy</h1>
      <p style={{ opacity: 0.85, marginBottom: 24 }}>
        We collect only the information required to process orders, deliver products, and support your account.
        Payment cards are processed by Stripe and are never stored directly by this storefront.
      </p>
      <h2 style={{ marginBottom: 8 }}>What we collect</h2>
      <p style={{ opacity: 0.85, marginBottom: 16 }}>
        Contact details, shipping and billing addresses, order details, and support communications.
      </p>
      <h2 style={{ marginBottom: 8 }}>How we use it</h2>
      <p style={{ opacity: 0.85, marginBottom: 16 }}>
        To fulfill orders, provide shipping updates, prevent fraud, and meet legal or tax obligations.
      </p>
      <h2 style={{ marginBottom: 8 }}>Retention and deletion</h2>
      <p style={{ opacity: 0.85, marginBottom: 24 }}>
        We keep order records for accounting and support. Customer data export and deletion requests are handled through
        admin workflows documented in our customer data posture policy.
      </p>
      <h2 style={{ marginBottom: 8 }}>Contact</h2>
      {contactLines.length ? (
        <ul style={{ margin: 0, paddingLeft: 20, opacity: 0.9 }}>
          {contactLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p style={{ opacity: 0.85 }}>Contact information is available from the store operator on request.</p>
      )}
      <p style={{ marginTop: 36 }}>
        <Link href="/" style={{ color: 'var(--brand-secondary, #f2ede4)' }}>
          Return to storefront
        </Link>
      </p>
    </main>
  );
}
