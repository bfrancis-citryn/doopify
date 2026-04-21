import { CartProvider } from '../../context/CartContext';

export const metadata = {
  title: 'Shop — Doopify',
  description: 'Browse our collection',
};

export default function ShopLayout({ children }) {
  return (
    <CartProvider>
      {children}
    </CartProvider>
  );
}
