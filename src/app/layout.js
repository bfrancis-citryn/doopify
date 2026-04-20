import './globals.css';
import { Inter, Manrope } from 'next/font/google';
import { cookies } from 'next/headers';
import { ThemeProvider } from '../context/ThemeContext';
import { OrdersProvider } from '../context/OrdersContext';
import { CustomersProvider } from '../context/CustomersContext';
import { DiscountsProvider } from '../context/DiscountsContext';
import { ProductsProvider } from '../context/ProductsContext';
import { SettingsProvider } from '../context/SettingsContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-headline',
});

export const metadata = {
  title: 'Doopify | Commerce OS',
  description: 'Doopify Commerce OS',
};

function getInitialTheme(cookieStore) {
  const cookieTheme = cookieStore.get('doopify-theme')?.value;

  if (cookieTheme === 'light' || cookieTheme === 'dark' || cookieTheme === 'system') {
    return cookieTheme;
  }

  return 'system';
}

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const initialTheme = getInitialTheme(cookieStore);
  const initialResolvedTheme = initialTheme === 'dark' ? 'dark' : 'light';

  return (
    <html lang="en" data-theme={initialResolvedTheme} style={{ colorScheme: initialResolvedTheme }}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} ${manrope.variable}`}>
        <ThemeProvider initialTheme={initialTheme}>
          <SettingsProvider>
            <CustomersProvider>
              <DiscountsProvider>
                <ProductsProvider>
                  <OrdersProvider>{children}</OrdersProvider>
                </ProductsProvider>
              </DiscountsProvider>
            </CustomersProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
