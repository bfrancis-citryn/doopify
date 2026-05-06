import { Suspense } from 'react';

import CheckoutSuccessClientPage from './CheckoutSuccessClientPage';

export const metadata = {
  title: 'Checkout status - Doopify',
  description: 'Order confirmation and payment status',
};

function SuccessFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#080808',
        color: '#f3efe7',
        fontFamily: 'var(--font-body), sans-serif',
      }}
    >
      Processing your order...
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<SuccessFallback />}>
      <CheckoutSuccessClientPage />
    </Suspense>
  );
}
