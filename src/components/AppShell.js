"use client";

import Header from './Header/Header';
import Sidebar from './Sidebar/Sidebar';
import styles from '../app/page.module.css';

export default function AppShell({ children, searchValue = '', onSearchChange, onCreateOrder, onNotificationsClick, onQuickActionClick }) {
  return (
    <div className={styles.appContainer}>
      <Sidebar />
      <div className={styles.mainCanvas}>
        <Header
          onCreateOrder={onCreateOrder}
          onNotificationsClick={onNotificationsClick}
          onQuickActionClick={onQuickActionClick}
          onSearchChange={onSearchChange}
          searchValue={searchValue}
        />
        <div className={styles.viewContainer}>{children}</div>
      </div>
    </div>
  );
}
