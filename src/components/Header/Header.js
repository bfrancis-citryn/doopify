import Image from 'next/image';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.leftGroup}>
        <div className={styles.searchContainer}>
          <span className={`material-symbols-outlined ${styles.searchIcon} text-lg text-slate-400`}>search</span>
          <input 
            className={`${styles.searchInput} text-sm`} 
            placeholder="Search orders, products, customers..." 
            type="text" 
          />
        </div>
      </div>
      
      <div className={styles.rightGroup}>
        <button className={`${styles.createBtn} text-sm font-bold tracking-tight font-headline`}>
          Create Order
        </button>
        
        <div className={styles.actionsGroup}>
          <button className={styles.iconBtn}>
            <span className="material-symbols-outlined">bolt</span>
          </button>
          <button className={`${styles.iconBtn} ${styles.relative}`}>
            <span className="material-symbols-outlined">notifications</span>
            <span className={styles.badge}></span>
          </button>
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
