"use client";

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSettings } from '../../context/SettingsContext';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard', exact: true },
  { href: '/admin/collections', label: 'Collections', icon: 'dashboard_customize' },
  { href: '/orders', label: 'Orders', icon: 'shopping_cart' },
  { href: '/draft-orders', label: 'Draft Orders', icon: 'edit_document' },
  { href: '/products', label: 'Products', icon: 'inventory_2' },
  { href: '/media', label: 'Media', icon: 'photo_library' },
  { href: '/customers', label: 'Customers', icon: 'groups' },
  { href: '/discounts', label: 'Discounts', icon: 'sell' },
  { href: '/admin/webhooks', label: 'Webhooks', icon: 'sync_problem' },
  { href: '/analytics', label: 'Analytics', icon: 'analytics' },
];

const emptySubscribe = () => () => {};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { settings } = useSettings();
  const activePathname = useSyncExternalStore(emptySubscribe, () => pathname, () => '');
  const isSettingsActive = activePathname === '/settings' || activePathname.startsWith('/settings/');

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandLockup}>
          {settings.logoUrl ? (
            <img alt={settings.storeName} className={styles.brandLogo} src={settings.logoUrl} />
          ) : (
            <div className={`font-headline ${styles.brandBadge}`}>{settings.storeName.slice(0, 2).toUpperCase()}</div>
          )}

          <div className={styles.brandCopy}>
            <p className={`text-xs font-headline tracking-widest ${styles.brandEyebrow}`}>Obsidian Glass</p>
            <h1 className={`text-xl font-bold tracking-tighter font-headline ${styles.brandTitle}`}>{settings.storeName}</h1>
            <p className={`text-xs font-headline tracking-tight ${styles.brandSubtitle}`}>Commerce command layer</p>
          </div>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(item => {
          const isActive =
            item.href !== '#' &&
            (item.exact
              ? activePathname === item.href
              : activePathname === item.href || activePathname.startsWith(`${item.href}/`));
          return (
            <Link key={item.label} href={item.href} className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''} text-sm font-semibold font-headline tracking-tight`}>
              <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.bottomNav}>
        <Link
          href="/settings"
          className={`${styles.navLink} ${isSettingsActive ? styles.navLinkActive : ''} text-sm font-semibold font-headline tracking-tight`}
        >
          <span className="material-symbols-outlined" style={isSettingsActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>settings</span>
          <span>Settings</span>
        </Link>
        <button className={`${styles.navLink} text-sm font-semibold font-headline tracking-tight`} onClick={handleLogout} type="button">
          <span className="material-symbols-outlined">logout</span>
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
