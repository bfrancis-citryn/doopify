"use client";

import Header from './Header/Header';
import Sidebar from './Sidebar/Sidebar';
import ThemeToggle from './ThemeToggle';
import { useSettings } from '../context/SettingsContext';
import styles from '../app/page.module.css';

export default function AppShell({ children, searchValue = '', onSearchChange, onCreateOrder, onNotificationsClick, onQuickActionClick }) {
  const { settings } = useSettings();

  return (
    <div className={styles.appContainer} style={{ ['--primary']: settings.brandPrimary, ['--blue-600']: settings.brandAccent }}>
      <Sidebar />
      <div className={styles.mainCanvas}>
        <Header
          onCreateOrder={onCreateOrder}
          onNotificationsClick={onNotificationsClick}
          onQuickActionClick={onQuickActionClick}
          onSearchChange={onSearchChange}
          searchValue={searchValue}
        />
        <div className={styles.themeToggleDock}>
          <ThemeToggle />
        </div>
        <div className={styles.viewContainer}>{children}</div>
      </div>
    </div>
  );
}
