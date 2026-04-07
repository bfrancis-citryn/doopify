"use client";

import { useMemo, useState } from 'react';
import AppShell from '../AppShell';
import { useSettings } from '../../context/SettingsContext';
import styles from './SettingsWorkspace.module.css';

const SETTINGS_SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'branding', label: 'Branding' },
  { id: 'locations', label: 'Locations' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'payments', label: 'Payments' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'users', label: 'Users & permissions' },
];

export default function SettingsWorkspace() {
  const [activeSection, setActiveSection] = useState('general');
  const { settings, updateSettings } = useSettings();

  const activeTitle = useMemo(() => SETTINGS_SECTIONS.find(section => section.id === activeSection)?.label || 'Settings', [activeSection]);

  return (
    <AppShell onCreateOrder={() => {}} onNotificationsClick={() => {}} onQuickActionClick={() => {}} onSearchChange={() => {}} searchValue="">
      <div className={styles.page}>
        <div className={styles.navPanel}>
          <div className={styles.navHeader}>
            <p className={styles.eyebrow}>Settings</p>
            <h2 className={styles.title}>Store configuration</h2>
          </div>
          <div className={styles.sectionList}>
            {SETTINGS_SECTIONS.map(section => (
              <button key={section.id} className={activeSection === section.id ? styles.sectionButtonActive : styles.sectionButton} onClick={() => setActiveSection(section.id)} type="button">
                {section.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.detailPanel}>
          <div className={styles.detailCard}>
            <div className={styles.detailHeader}>
              <div>
                <p className={styles.eyebrow}>Settings</p>
                <h2 className={styles.title}>{activeTitle}</h2>
              </div>
              <button className={styles.saveButton} type="button">Save</button>
            </div>

            {activeSection === 'general' ? (
              <div className={styles.formGrid}>
                <label className={styles.field}><span>Store name</span><input className={styles.input} onChange={event => updateSettings({ storeName: event.target.value })} value={settings.storeName} /></label>
                <label className={styles.field}><span>Support email</span><input className={styles.input} onChange={event => updateSettings({ supportEmail: event.target.value })} value={settings.supportEmail} /></label>
                <label className={styles.field}><span>Phone</span><input className={styles.input} onChange={event => updateSettings({ phone: event.target.value })} value={settings.phone} /></label>
                <label className={styles.field}><span>Address</span><input className={styles.input} onChange={event => updateSettings({ address: event.target.value })} value={settings.address} /></label>
                <label className={styles.field}><span>Timezone</span><input className={styles.input} onChange={event => updateSettings({ timezone: event.target.value })} value={settings.timezone} /></label>
                <label className={styles.field}><span>Currency</span><input className={styles.input} onChange={event => updateSettings({ currency: event.target.value })} value={settings.currency} /></label>
              </div>
            ) : null}

            {activeSection === 'branding' ? (
              <div className={styles.formGrid}>
                <label className={styles.field}><span>Logo URL</span><input className={styles.input} onChange={event => updateSettings({ logoUrl: event.target.value })} value={settings.logoUrl} /></label>
                <label className={styles.field}><span>Primary brand color</span><input className={styles.input} onChange={event => updateSettings({ brandPrimary: event.target.value })} value={settings.brandPrimary} /></label>
                <label className={styles.field}><span>Accent color</span><input className={styles.input} onChange={event => updateSettings({ brandAccent: event.target.value })} value={settings.brandAccent} /></label>
                <label className={styles.field}><span>Order prefix</span><input className={styles.input} onChange={event => updateSettings({ orderPrefix: event.target.value })} value={settings.orderPrefix} /></label>
              </div>
            ) : null}

            {activeSection === 'locations' ? (
              <div className={styles.formGrid}>
                <label className={styles.field}><span>Default location</span><input className={styles.input} onChange={event => updateSettings({ defaultLocation: event.target.value })} value={settings.defaultLocation} /></label>
                <label className={styles.field}><span>Shipping origin</span><input className={styles.input} onChange={event => updateSettings({ shippingOrigin: event.target.value })} value={settings.shippingOrigin} /></label>
              </div>
            ) : null}

            {activeSection === 'shipping' ? (
              <div className={styles.formGrid}>
                <label className={styles.field}><span>Free shipping threshold</span><input className={styles.input} onChange={event => updateSettings({ freeShippingThreshold: event.target.value })} value={settings.freeShippingThreshold} /></label>
                <label className={styles.field}><span>Low inventory alert</span><input className={styles.input} onChange={event => updateSettings({ lowInventoryAlert: event.target.value })} value={settings.lowInventoryAlert} /></label>
              </div>
            ) : null}

            {activeSection === 'payments' ? (
              <div className={styles.infoBlock}>Set payment providers, capture mode, manual payment methods, and refund rules here next.</div>
            ) : null}

            {activeSection === 'notifications' ? (
              <div className={styles.formGrid}>
                <label className={styles.field}><span>Sender email</span><input className={styles.input} onChange={event => updateSettings({ senderEmail: event.target.value })} value={settings.senderEmail} /></label>
              </div>
            ) : null}

            {activeSection === 'users' ? (
              <div className={styles.infoBlock}>Staff accounts, roles, permissions, and approval rules should live here.</div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
