import '../_styles/shared-base.css';
import '../_styles/dashboard-theme.css';
import { inter, manrope } from '../_shared/fonts';
import { OrdersProvider } from '@/context/OrdersContext';
import { CustomersProvider } from '@/context/CustomersContext';
import { DiscountsProvider } from '@/context/DiscountsContext';
import { ProductsProvider } from '@/context/ProductsContext';
import { SettingsProvider } from '@/context/SettingsContext';
import AdminThemeProvider from '@/components/admin/ui/AdminThemeProvider';
import AdminCommandPalette from '@/components/admin/ui/AdminCommandPalette';
import AdminSpotlightRuntime from '@/components/admin/ui/AdminSpotlightRuntime';

export const metadata = {
  title: 'Doopify | Commerce OS',
  description: 'Doopify Commerce OS',
};

export default function DashboardLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} ${manrope.variable} dashboard-body`} suppressHydrationWarning>
        <AdminThemeProvider>
          <SettingsProvider>
            <ProductsProvider>
              <OrdersProvider>
                <CustomersProvider>
                  <DiscountsProvider>
                    {children}
                    <AdminSpotlightRuntime />
                    <AdminCommandPalette />
                  </DiscountsProvider>
                </CustomersProvider>
              </OrdersProvider>
            </ProductsProvider>
          </SettingsProvider>
        </AdminThemeProvider>
      </body>
    </html>
  );
}
