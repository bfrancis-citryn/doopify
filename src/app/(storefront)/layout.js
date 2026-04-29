import '../_styles/shared-base.css';
import '../_styles/storefront-theme.css';
import { inter, manrope } from '../_shared/fonts';
import { CartProvider } from '@/context/CartContext';
import { resolveButtonRadiusCss, resolveFontStack } from '@/lib/brand-kit';
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

  const primaryColor = store?.primaryColor || '#c9a86c';
  const secondaryColor = store?.secondaryColor || '#f2ede4';
  const accentColor = store?.accentColor || primaryColor;
  const textColor = store?.textColor || '#f2ede4';
  const headingFont = resolveFontStack(store?.headingFont);
  const bodyFont = resolveFontStack(store?.bodyFont);
  const buttonRadius = resolveButtonRadiusCss(store?.buttonRadius);
  const buttonTextTransform = store?.buttonTextTransform === 'uppercase' ? 'uppercase' : 'none';

  return (
    <html
      lang="en"
      style={{
        colorScheme: 'dark',
        '--store-primary': primaryColor,
        '--store-secondary': secondaryColor,
        '--brand-primary': primaryColor,
        '--brand-secondary': secondaryColor,
        '--brand-accent': accentColor,
        '--brand-text': textColor,
        '--brand-heading-font': headingFont,
        '--brand-body-font': bodyFont,
        '--brand-button-radius': buttonRadius,
        '--brand-button-transform': buttonTextTransform,
      }}
      suppressHydrationWarning
    >
      <head>{store?.faviconUrl ? <link rel="icon" href={store.faviconUrl} /> : null}</head>
      <body
        className={`${inter.variable} ${manrope.variable} storefront-body`}
        style={{
          '--font-body': bodyFont,
          '--font-headline': headingFont,
        }}
        suppressHydrationWarning
      >
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
