"use client";

import Header from './Header/Header';
import Sidebar from './Sidebar/Sidebar';
import styles from './layout/AppShell.module.css';

export default function AppShell({
  children,
  searchValue = '',
  onSearchChange,
  onCreateOrder,
  onNotificationsClick,
  onQuickActionClick,
  primaryActionLabel,
  searchPlaceholder,
}) {
  return (
    <div className={styles.appContainer}>
      <Sidebar />
      <div className={styles.mainCanvas}>
        <Header
          onCreateOrder={onCreateOrder}
          onNotificationsClick={onNotificationsClick}
          onQuickActionClick={onQuickActionClick}
          onSearchChange={onSearchChange}
          primaryActionLabel={primaryActionLabel}
          searchPlaceholder={searchPlaceholder}
          searchValue={searchValue}
        />
        <div className={styles.viewContainer}>{children}</div>
      </div>
    </div>
  );
}
