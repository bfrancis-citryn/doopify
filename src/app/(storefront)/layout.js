import '../_styles/shared-base.css';
import '../_styles/storefront-theme.css';
import { inter, manrope } from '../_shared/fonts';

export const metadata = {
  title: 'Doopify | Storefront',
  description: 'Doopify storefront experience',
};

export default function StorefrontLayout({ children }) {
  return (
    <html lang="en" style={{ colorScheme: 'dark' }} suppressHydrationWarning>
      <body className={`${inter.variable} ${manrope.variable} storefront-body`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
