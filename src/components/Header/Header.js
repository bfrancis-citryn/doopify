import Image from 'next/image';
import AdminButton from '@/components/admin/ui/AdminButton';
import AdminThemeToggle from '@/components/admin/ui/AdminThemeToggle';
import styles from './Header.module.css';

export default function Header({
  onCreateOrder,
  onNotificationsClick,
  onQuickActionClick,
  onSearchChange,
  primaryActionLabel = 'New order',
  searchPlaceholder = 'Search orders, products, customers...',
  searchValue = '',
}) {
  function openCommandPalette() {
    window.dispatchEvent(
      new CustomEvent('admin-command-palette', {
        detail: { action: 'open' },
      })
    );
  }

  return (
    <header className={`${styles.header} glass-card refraction-edge admin-spotlight`}>
      <div className={styles.leftGroup}>
        <div className={`font-headline ${styles.consoleBadge}`}>
          <span className="material-symbols-outlined">blur_on</span>
          <span>Live operations</span>
        </div>

        <div className={styles.searchContainer}>
          <span className={`material-symbols-outlined ${styles.searchIcon} text-lg text-slate-400`}>search</span>
          <input
            className={`${styles.searchInput} text-sm`}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            type="text"
            value={searchValue}
          />
        </div>

        <AdminButton
          className={styles.commandButton}
          onClick={openCommandPalette}
          size="sm"
          variant="secondary"
        >
          Search
          <span className={styles.commandHint}>Cmd+K</span>
        </AdminButton>
      </div>

      <div className={styles.rightGroup}>
        <AdminThemeToggle className={styles.themeToggle} />

        {primaryActionLabel ? (
          <AdminButton
            className={`${styles.createBtn} text-sm font-bold tracking-tight font-headline`}
            onClick={onCreateOrder}
            variant="primary"
          >
            {primaryActionLabel}
          </AdminButton>
        ) : null}

        <div className={styles.actionsGroup}>
          <AdminButton className={styles.iconBtn} onClick={onQuickActionClick} variant="icon">
            <span className="material-symbols-outlined">bolt</span>
          </AdminButton>
          <AdminButton className={`${styles.iconBtn} ${styles.relative}`} onClick={onNotificationsClick} variant="icon">
            <span className="material-symbols-outlined">notifications</span>
            <span className={styles.badge}></span>
          </AdminButton>
          <div className={styles.avatar}>
            <Image 
              src="/images/avatar.jpg" 
              alt="Profile" 
              width={32} 
              height={32} 
              className={styles.avatarImg}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
