"use client";

import { useProductStore } from '../../context/ProductContext';
import styles from './ConfirmDialog.module.css';

export default function ConfirmDialog() {
  const { confirmDialog, actions } = useProductStore();

  if (!confirmDialog) {
    return null;
  }

  return (
    <div className={styles.backdrop}>
      <div aria-modal="true" className={styles.dialog} role="dialog">
        <p className={styles.overline}>Attention needed</p>
        <h3 className={`font-headline ${styles.title}`}>{confirmDialog.title}</h3>
        <p className={styles.description}>{confirmDialog.description}</p>

        {confirmDialog.kind === 'unsaved-changes' ? (
          <div className={styles.actions}>
            <button className={styles.ghostButton} onClick={() => actions.confirmDialogAction('keep-editing')} type="button">
              Keep editing
            </button>
            <button className={styles.secondaryButton} onClick={() => actions.confirmDialogAction('discard')} type="button">
              Discard changes
            </button>
            <button className={styles.primaryButton} onClick={() => actions.confirmDialogAction('save')} type="button">
              Save and continue
            </button>
          </div>
        ) : (
          <div className={styles.actions}>
            <button className={styles.ghostButton} onClick={() => actions.dismissConfirmDialog()} type="button">
              Cancel
            </button>
            <button className={styles.dangerButton} onClick={() => actions.confirmDialogAction('confirm')} type="button">
              {confirmDialog.kind === 'delete-product' ? 'Delete product' : 'Delete variant'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
