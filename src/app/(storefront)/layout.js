import '../_styles/shared-base.css';
import '../_styles/storefront-theme.css';
import { inter, manrope } from '../_shared/fonts';
import { CartProvider } from '@/context/CartContext';
import { getPublicStorefrontSettings } from '@/server/services/settings.service';

export const metadata = {
  title: 'Doopify | Storefront',
  description: 'Doopify storefront experience',
};

export default async function StorefrontLayout({ children }) {
  let store = null;

  try {
    store = await getPublicStorefrontSettings();
  } catch (error) {
    console.error('[StorefrontLayout]', error);
  }

  return (
    <html
      lang="en"
      style={{
        colorScheme: 'dark',
        '--store-primary': store?.primaryColor || '#c9a86c',
        '--store-secondary': store?.secondaryColor || '#f2ede4',
      }}
      suppressHydrationWarning
    >
      <body className={`${inter.variable} ${manrope.variable} storefront-body`} suppressHydrationWarning>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
