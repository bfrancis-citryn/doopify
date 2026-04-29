import CheckoutClientPage from './CheckoutClientPage';
import { getPublicStorefrontSettings } from '@/server/services/settings.service';

export const metadata = {
  title: 'Checkout - Doopify',
  description: 'Secure checkout',
};

export default async function CheckoutPage({ searchParams }) {
  let store = null;
  const params = await searchParams;
  const recoveryToken = typeof params?.recovery_token === 'string' ? params.recovery_token : '';

  try {
    store = await getPublicStorefrontSettings();
  } catch (error) {
    console.error('[CheckoutPage]', error);
  }

  return (
    <CheckoutClientPage
      publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
      recoveryToken={recoveryToken}
      store={store}
    />
  );
}
