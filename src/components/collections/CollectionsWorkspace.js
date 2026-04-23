"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import AppShell from '../AppShell';
import styles from './CollectionsWorkspace.module.css';

const EMPTY_DRAFT = {
  id: null,
  title: '',
  handle: '',
  description: '',
  imageUrl: '',
  sortOrder: 'MANUAL',
  productIds: [],
};

const SORT_OPTIONS = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'NEWEST', label: 'Newest first' },
  { value: 'TITLE_ASC', label: 'Title A-Z' },
  { value: 'PRICE_ASC', label: 'Price low to high' },
  { value: 'PRICE_DESC', label: 'Price high to low' },
];

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function toDraft(collection) {
  return {
    id: collection.id,
    title: collection.title || '',
    handle: collection.handle || '',
    description: collection.description || '',
    imageUrl: collection.imageUrl || '',
    sortOrder: collection.sortOrder || 'MANUAL',
    productIds: collection.productIds || [],
  };
}

function toCollectionSummary(collection) {
  return {
    id: collection.id,
    title: collection.title || '',
    handle: collection.handle || '',
    description: collection.description || '',
    sortOrder: collection.sortOrder || 'MANUAL',
    productCount: collection.productCount || 0,
    updatedAt: collection.updatedAt || null,
  };
}

function sortCollectionsByUpdatedAt(collections) {
  return [...collections].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });
}

function upsertCollectionSummary(collections, nextCollection) {
  const summary = toCollectionSummary(nextCollection);
  const existingIndex = collections.findIndex((collection) => collection.id === summary.id);

  if (existingIndex === -1) {
    return sortCollectionsByUpdatedAt([summary, ...collections]);
  }

  const nextCollections = [...collections];
  nextCollections[existingIndex] = {
    ...nextCollections[existingIndex],
    ...summary,
  };

  return sortCollectionsByUpdatedAt(nextCollections);
}

export default function CollectionsWorkspace() {
  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState('new');
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const detailRequestRef = useRef(0);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredProductSearch = useDeferredValue(productSearch);

  async function loadCollectionDetail(collectionId, fallbackCollection) {
    if (!collectionId || collectionId === 'new') {
      return null;
    }

    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setLoadingCollection(true);

    if (fallbackCollection) {
      setDraft(toDraft(fallbackCollection));
    }

    try {
      const response = await fetch(`/api/collections/${collectionId}`);
      const json = await response.json();

      if (detailRequestRef.current !== requestId) {
        return null;
      }

      if (!json.success) {
        setNotice(json.error || 'Collection details could not be loaded.');
        return null;
      }

      setSelectedCollectionId(collectionId);
      setDraft(toDraft(json.data));
      return json.data;
    } catch (error) {
      console.error('[CollectionsWorkspace] failed to load collection detail', error);

      if (detailRequestRef.current === requestId) {
        setNotice('Collection details could not be loaded right now.');
      }

      return null;
    } finally {
      if (detailRequestRef.current === requestId) {
        setLoadingCollection(false);
      }
    }
  }

  async function loadWorkspace(preferredCollectionId) {
    setLoading(true);

    try {
      const [collectionsRes, productsRes] = await Promise.all([
        fetch('/api/collections'),
        fetch('/api/products?pageSize=200&status=ACTIVE'),
      ]);

      const [collectionsJson, productsJson] = await Promise.all([
        collectionsRes.json(),
        productsRes.json(),
      ]);

      const nextCollections = collectionsJson.success ? collectionsJson.data || [] : [];
      const nextProducts = productsJson.success ? productsJson.data?.products || [] : [];

      setCollections(nextCollections);
      setProducts(nextProducts);

      const selected =
        nextCollections.find((collection) => collection.id === preferredCollectionId) ||
        nextCollections.find((collection) => collection.id === selectedCollectionId) ||
        nextCollections[0] ||
        null;

      if (selected) {
        setSelectedCollectionId(selected.id);
        await loadCollectionDetail(selected.id, selected);
      } else {
        detailRequestRef.current += 1;
        setLoadingCollection(false);
        setSelectedCollectionId('new');
        setDraft(EMPTY_DRAFT);
      }
    } catch (error) {
      console.error('[CollectionsWorkspace] failed to load workspace', error);
      setNotice('Collections could not be loaded right now.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, []);

  const filteredCollections = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) return collections;

    return collections.filter((collection) => {
      return (
        collection.title.toLowerCase().includes(query) ||
        collection.handle.toLowerCase().includes(query) ||
        (collection.description || '').toLowerCase().includes(query)
      );
    });
  }, [collections, deferredSearchQuery]);

  const filteredProducts = useMemo(() => {
    const query = deferredProductSearch.trim().toLowerCase();
    if (!query) return products;

    return products.filter((product) => {
      return (
        product.title.toLowerCase().includes(query) ||
        (product.vendor || '').toLowerCase().includes(query) ||
        product.handle.toLowerCase().includes(query)
      );
    });
  }, [products, deferredProductSearch]);

  const assignedProducts = useMemo(() => {
    const productMap = new Map(products.map((product) => [product.id, product]));

    return draft.productIds
      .map((productId) => productMap.get(productId))
      .filter(Boolean);
  }, [draft.productIds, products]);

  const isNewCollection = draft.id == null;
  const handlePreview = draft.handle.trim() || slugify(draft.title);

  function selectCollection(collection) {
    setSelectedCollectionId(collection.id);
    setNotice('');
    void loadCollectionDetail(collection.id, collection);
  }

  function resetToNewCollection() {
    detailRequestRef.current += 1;
    setLoadingCollection(false);
    setSelectedCollectionId('new');
    setDraft(EMPTY_DRAFT);
    setNotice('');
  }

  function updateDraft(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleAssignedProduct(productId) {
    setDraft((current) => {
      const exists = current.productIds.includes(productId);

      return {
        ...current,
        productIds: exists
          ? current.productIds.filter((id) => id !== productId)
          : [...current.productIds, productId],
      };
    });
  }

  function moveAssignedProduct(productId, direction) {
    setDraft((current) => {
      const index = current.productIds.indexOf(productId);
      if (index === -1) return current;

      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.productIds.length) {
        return current;
      }

      const nextProductIds = [...current.productIds];
      const [item] = nextProductIds.splice(index, 1);
      nextProductIds.splice(nextIndex, 0, item);

      return {
        ...current,
        productIds: nextProductIds,
      };
    });
  }

  async function handleSave() {
    if (!draft.title.trim()) {
      setNotice('A collection title is required before saving.');
      return;
    }

    const wasExisting = Boolean(draft.id);

    setSaving(true);
    setNotice('');

    const payload = {
      title: draft.title.trim(),
      handle: draft.handle.trim() || undefined,
      description: draft.description.trim() || undefined,
      imageUrl: draft.imageUrl.trim() || undefined,
      sortOrder: draft.sortOrder,
      productIds: draft.productIds,
    };

    try {
      const response = await fetch(
        draft.id ? `/api/collections/${draft.id}` : '/api/collections',
        {
          method: draft.id ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const json = await response.json();

      if (!json.success) {
        setNotice(json.error || 'Collection could not be saved.');
        return;
      }

      setSelectedCollectionId(json.data.id);
      setDraft(toDraft(json.data));
      setCollections((current) => upsertCollectionSummary(current, json.data));
      setNotice(wasExisting ? 'Collection updated.' : 'Collection created.');
    } catch (error) {
      console.error('[CollectionsWorkspace] save failed', error);
      setNotice('Collection could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft.id) {
      resetToNewCollection();
      return;
    }

    if (!window.confirm(`Delete ${draft.title}? This cannot be undone.`)) {
      return;
    }

    const deletedCollectionId = draft.id;
    const deletedCollectionIndex = collections.findIndex((collection) => collection.id === deletedCollectionId);

    setSaving(true);
    setNotice('');

    try {
      const response = await fetch(`/api/collections/${draft.id}`, {
        method: 'DELETE',
      });

      const json = await response.json();
      if (!json.success) {
        setNotice(json.error || 'Collection could not be deleted.');
        return;
      }

      const nextCollections = collections.filter((collection) => collection.id !== deletedCollectionId);
      setCollections(nextCollections);

      if (!nextCollections.length) {
        resetToNewCollection();
        setNotice('Collection deleted.');
        return;
      }

      const nextSelectedCollection =
        nextCollections[Math.min(deletedCollectionIndex, nextCollections.length - 1)] || nextCollections[0];

      setSelectedCollectionId(nextSelectedCollection.id);
      setNotice('Collection deleted.');
      await loadCollectionDetail(nextSelectedCollection.id, nextSelectedCollection);
    } catch (error) {
      console.error('[CollectionsWorkspace] delete failed', error);
      setNotice('Collection could not be deleted.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      onCreateOrder={resetToNewCollection}
      onNotificationsClick={() => setNotice('Collections are ready for merchandising work.')}
      onQuickActionClick={() => setNotice('Use the product library to assign products and order them.')}
      onSearchChange={(event) => setSearchQuery(event.target.value)}
      primaryActionLabel="New collection"
      searchPlaceholder="Search collections..."
      searchValue={searchQuery}
    >
      <div className={styles.workspace}>
        <section className={styles.listPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Collections</p>
              <h1 className={styles.title}>Merchandising</h1>
            </div>
            <button className={styles.secondaryButton} onClick={resetToNewCollection} type="button">
              New
            </button>
          </div>

          {loading ? (
            <div className={styles.loadingState}>Loading collections...</div>
          ) : filteredCollections.length ? (
            <div className={styles.collectionList}>
              {filteredCollections.map((collection) => {
                const isActive = selectedCollectionId === collection.id;

                return (
                  <button
                    key={collection.id}
                    className={`${styles.collectionCard} ${isActive ? styles.collectionCardActive : ''}`}
                    onClick={() => selectCollection(collection)}
                    type="button"
                  >
                    <div className={styles.collectionCardHeader}>
                      <h2>{collection.title}</h2>
                      <span>{collection.productCount} products</span>
                    </div>
                    <p>{collection.description || 'No collection description yet.'}</p>
                    <div className={styles.collectionCardMeta}>
                      <span>/{collection.handle}</span>
                      <span>{collection.sortOrder.replace('_', ' ')}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No collections yet</strong>
              <p>Create your first collection to start shaping storefront merchandising.</p>
            </div>
          )}
        </section>

        <section className={styles.editorPanel}>
          <div className={styles.editorHeader}>
            <div>
              <p className={styles.eyebrow}>{isNewCollection ? 'New collection' : 'Editing collection'}</p>
              <h2 className={styles.editorTitle}>{draft.title || 'Untitled collection'}</h2>
              <p className={styles.previewPath}>
                Storefront path: <code>/collections/{handlePreview || 'collection-handle'}</code>
              </p>
            </div>
            <div className={styles.editorActions}>
              {!isNewCollection ? (
                <button
                  className={styles.deleteButton}
                  disabled={saving || loadingCollection}
                  onClick={handleDelete}
                  type="button"
                >
                  Delete
                </button>
              ) : null}
              <button
                className={styles.primaryButton}
                disabled={saving || loadingCollection}
                onClick={handleSave}
                type="button"
              >
                {saving ? 'Saving...' : isNewCollection ? 'Create collection' : 'Save changes'}
              </button>
            </div>
          </div>

          {loadingCollection ? <div className={styles.notice}>Loading collection details...</div> : null}
          {notice ? <div className={styles.notice}>{notice}</div> : null}

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Title</span>
              <input
                onChange={(event) => updateDraft('title', event.target.value)}
                placeholder="Summer Essentials"
                value={draft.title}
              />
            </label>

            <label className={styles.field}>
              <span>Handle</span>
              <input
                onChange={(event) => updateDraft('handle', event.target.value)}
                placeholder={slugify(draft.title) || 'summer-essentials'}
                value={draft.handle}
              />
            </label>

            <label className={styles.field}>
              <span>Cover image URL</span>
              <input
                onChange={(event) => updateDraft('imageUrl', event.target.value)}
                placeholder="https://..."
                value={draft.imageUrl}
              />
            </label>

            <label className={styles.field}>
              <span>Sort order</span>
              <select
                onChange={(event) => updateDraft('sortOrder', event.target.value)}
                value={draft.sortOrder}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Description</span>
              <textarea
                onChange={(event) => updateDraft('description', event.target.value)}
                placeholder="Explain what this collection is for and how it should feel on the storefront."
                rows={4}
                value={draft.description}
              />
            </label>
          </div>

          <div className={styles.assignmentGrid}>
            <div className={styles.assignmentPanel}>
              <div className={styles.assignmentHeader}>
                <div>
                  <p className={styles.assignmentEyebrow}>Assigned products</p>
                  <strong>{assignedProducts.length} in order</strong>
                </div>
              </div>

              {assignedProducts.length ? (
                <div className={styles.assignedList}>
                  {assignedProducts.map((product, index) => (
                    <div className={styles.assignedItem} key={product.id}>
                      <div className={styles.assignedCopy}>
                        <strong>{product.title}</strong>
                        <span>{product.vendor || product.handle}</span>
                      </div>
                      <div className={styles.assignedActions}>
                        <button
                          disabled={index === 0 || loadingCollection}
                          onClick={() => moveAssignedProduct(product.id, -1)}
                          type="button"
                        >
                          Up
                        </button>
                        <button
                          disabled={index === assignedProducts.length - 1 || loadingCollection}
                          onClick={() => moveAssignedProduct(product.id, 1)}
                          type="button"
                        >
                          Down
                        </button>
                        <button
                          disabled={loadingCollection}
                          onClick={() => toggleAssignedProduct(product.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.assignmentEmpty}>
                  Assign products from the library to build out this collection.
                </div>
              )}
            </div>

            <div className={styles.assignmentPanel}>
              <div className={styles.assignmentHeader}>
                <div>
                  <p className={styles.assignmentEyebrow}>Product library</p>
                  <strong>{filteredProducts.length} active products</strong>
                </div>
                <input
                  className={styles.productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Search products..."
                  value={productSearch}
                />
              </div>

              <div className={styles.libraryList}>
                {filteredProducts.map((product) => {
                  const isAssigned = draft.productIds.includes(product.id);

                  return (
                    <div className={styles.libraryItem} key={product.id}>
                      <div className={styles.libraryCopy}>
                        <strong>{product.title}</strong>
                        <span>{product.vendor || product.handle}</span>
                      </div>
                      <button
                        className={isAssigned ? styles.assignedButton : styles.assignButton}
                        disabled={loadingCollection}
                        onClick={() => toggleAssignedProduct(product.id)}
                        type="button"
                      >
                        {isAssigned ? 'Assigned' : 'Assign'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
