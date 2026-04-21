import './globals.css';
import { Inter, Manrope } from 'next/font/google';
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

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={{ colorScheme: 'dark' }}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} ${manrope.variable}`}>
        <SettingsProvider>
          <ProductsProvider>
            <OrdersProvider>
              <CustomersProvider>
                <DiscountsProvider>
                  {children}
                </DiscountsProvider>
              </CustomersProvider>
            </OrdersProvider>
          </ProductsProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
