import Link from 'next/link';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <h1 className={`text-xl font-bold tracking-tighter font-headline ${styles.brandTitle}`}>Aether</h1>
        <p className={`text-xs font-headline tracking-tight ${styles.brandSubtitle}`}>Next-Gen OS</p>
      </div>

      <nav className={styles.nav}>
        <Link href="#" className={`${styles.navLink} text-sm font-semibold font-headline tracking-tight`}>
          <span className="material-symbols-outlined">dashboard</span>
          <span>Dashboard</span>
        </Link>
        <Link href="#" className={`${styles.navLink} ${styles.navLinkActive} text-sm font-semibold font-headline tracking-tight`}>
          <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>inventory_2</span>
          <span>Products</span>
        </Link>
        <Link href="#" className={`${styles.navLink} text-sm font-semibold font-headline tracking-tight`}>
          <span className="material-symbols-outlined">warehouse</span>
          <span>Inventory</span>
        </Link>
        <Link href="#" className={`${styles.navLink} text-sm font-semibold font-headline tracking-tight`}>
          <span className="material-symbols-outlined">shopping_cart</span>
          <span>Orders</span>
        </Link>
        <Link href="#" className={`${styles.navLink} text-sm font-semibold font-headline tracking-tight`}>
          <span className="material-symbols-outlined">local_shipping</span>
          <span>Shipping</span>
        </Link>
        <Link href="#" className={`${styles.navLink} text-sm font-semibold font-headline tracking-tight`}>
          <span className="material-symbols-outlined">analytics</span>
          <span>Analytics</span>
        </Link>
        <Link href="#" className={`${styles.navLink} text-sm font-semibold font-headline tracking-tight`}>
          <span className="material-symbols-outlined">settings</span>
          <span>Settings</span>
        </Link>
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
