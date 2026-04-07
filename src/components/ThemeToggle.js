"use client";

import { useTheme } from '../context/ThemeContext';
import styles from './ThemeToggle.module.css';

const OPTIONS = [
  { id: 'system', icon: 'desktop_windows', label: 'System' },
  { id: 'light', icon: 'light_mode', label: 'Light' },
  { id: 'dark', icon: 'dark_mode', label: 'Dark' },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.toggleWrap}>
      {OPTIONS.map(option => (
        <button
          key={option.id}
          aria-label={option.label}
          className={theme === option.id ? styles.toggleButtonActive : styles.toggleButton}
          onClick={() => setTheme(option.id)}
          type="button"
        >
          <span className="material-symbols-outlined">{option.icon}</span>
        </button>
      ))}
    </div>
  );
}
