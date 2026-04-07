"use client";

import { useEffect, useEffectEvent } from 'react';
import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import { useProductStore } from '../../context/ProductContext';
import ProductCatalog from './ProductCatalog';
import ProductEditorDrawer from './ProductEditorDrawer';
import ConfirmDialog from './ConfirmDialog';
import ToastViewport from './ToastViewport';
import styles from '../../app/page.module.css';

export default function ProductsWorkspace() {
  const { editor, confirmDialog, searchQuery, actions } = useProductStore();

  const handleKeyDown = useEffectEvent(async event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && editor.isOpen) {
      event.preventDefault();
      await actions.saveDraft();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();

      if (confirmDialog) {
        actions.dismissConfirmDialog();
        return;
      }

      if (editor.isOpen) {
        await actions.requestCloseEditor();
      }
    }
  });

  const handleAutosave = useEffectEvent(async () => {
    await actions.saveDraft({ silent: true });
  });

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!editor.isOpen || !editor.autosaveEnabled || !editor.hasUnsavedChanges || !editor.isDraftValid || editor.isSaving) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      handleAutosave();
    }, 850);

    return () => window.clearTimeout(timeoutId);
  }, [editor.autosaveEnabled, editor.hasUnsavedChanges, editor.isDraftValid, editor.isOpen, editor.isSaving]);

  return (
    <>
      <div className={styles.appContainer}>
        <Sidebar />
        <div className={styles.mainCanvas}>
          <Header
            onCreateOrder={() => actions.showToast('Order creation is outside the catalog scope for now.', 'info')}
            onNotificationsClick={() => actions.showToast('No new catalog alerts right now.', 'info')}
            onQuickActionClick={() => actions.showToast('Quick actions are coming soon.', 'info')}
            onSearchChange={event => actions.setSearchQuery(event.target.value)}
            searchValue={searchQuery}
          />

          <div className={styles.viewContainer}>
            <div className={styles.splitView}>
              <ProductCatalog />

              <div className={editor.isOpen ? `${styles.detailDock} ${styles.detailDockOpen}` : styles.detailDock}>
                <div className={editor.isOpen ? `${styles.detailPanel} ${styles.detailPanelOpen}` : styles.detailPanel}>
                  <ProductEditorDrawer />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog />
      <ToastViewport />
    </>
  );
}
