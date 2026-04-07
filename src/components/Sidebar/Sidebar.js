import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { href: '/orders', label: 'Orders', icon: 'shopping_cart' },
  { href: '/draft-orders', label: 'Draft Orders', icon: 'edit_document' },
  { href: '/products', label: 'Products', icon: 'inventory_2' },
  { href: '/customers', label: 'Customers', icon: 'groups' },
  { href: '/discounts', label: 'Discounts', icon: 'sell' },
  { href: '/analytics', label: 'Analytics', icon: 'analytics' },
  { href: '#', label: 'Settings', icon: 'settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <h1 className={`text-xl font-bold tracking-tighter font-headline ${styles.brandTitle}`}>Doopify</h1>
        <p className={`text-xs font-headline tracking-tight ${styles.brandSubtitle}`}>Commerce OS</p>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(item => {
          const isActive = item.href !== '#' && pathname === item.href;
          return (
            <Link key={item.label} href={item.href} className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''} text-sm font-semibold font-headline tracking-tight`}>
              <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.bottomNav}>
        <Link href="#" className={`${styles.navLink} text-sm font-semibold font-headline tracking-tight`}>
          <span className="material-symbols-outlined">help_outline</span>
          <span>Support</span>
        </Link>
        <Link href="#" className={`${styles.navLink} text-sm font-semibold font-headline tracking-tight`}>
          <span className="material-symbols-outlined">person</span>
          <span>Account</span>
        </Link>
      </div>
    </aside>
  );
}
