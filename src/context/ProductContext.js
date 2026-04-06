"use client";

import { createContext, useContext, useMemo, useReducer } from 'react';
import {
  buildVariantTitle,
  cloneProduct,
  createDefaultVariantForProduct,
  createEmptyProductDraft,
  createEntityId,
  createImageAsset,
  createSeedProducts,
  deriveInventorySummary,
  ensureMediaState,
  formatMoney,
  generateVariantsFromOptions,
  getMissingVariantCombos,
  getNextSampleImage,
  prepareProductForSave,
  reorderImage,
  sanitizeOptions,
  syncOptionsWithVariants,
  validateProduct,
} from '../lib/productUtils';

const ProductContext = createContext(null);

const seededProducts = createSeedProducts();
const initialProduct = seededProducts[0] || null;

const initialState = {
  products: seededProducts,
  selectedProductId: initialProduct?.id || null,
  catalog: {
    searchQuery: '',
    activeFilter: 'all',
  },
  editor: {
    isOpen: Boolean(initialProduct),
    mode: initialProduct ? 'existing' : 'new',
    draftProduct: initialProduct ? cloneProduct(initialProduct) : null,
    baselineProduct: initialProduct ? cloneProduct(initialProduct) : null,
    previewImageId: initialProduct?.featuredImageId || initialProduct?.images?.[0]?.id || null,
    autosaveEnabled: false,
    isSaving: false,
    validationErrors: {},
  },
  confirmDialog: null,
  toasts: [],
};

function normalizeSkuValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

function mergeValidationErrors(...errorSets) {
  const mergedErrors = {};

  errorSets.forEach(errorSet => {
    if (!errorSet) {
      return;
    }

    Object.entries(errorSet).forEach(([key, value]) => {
      if (!value) {
        return;
      }

      if (key === 'variantRows') {
        mergedErrors.variantRows = mergedErrors.variantRows || {};

        Object.entries(value).forEach(([variantId, rowErrors]) => {
          mergedErrors.variantRows[variantId] = {
            ...(mergedErrors.variantRows[variantId] || {}),
            ...rowErrors,
          };
        });

        return;
      }

      mergedErrors[key] = value;
    });
  });

  if (mergedErrors.variantRows && !Object.keys(mergedErrors.variantRows).length) {
    delete mergedErrors.variantRows;
  }

  return mergedErrors;
}

function collectSkuValidationErrors(draftProduct, products) {
  if (!draftProduct) {
    return {};
  }

  const errors = {};
  const externalSkus = new Set();

  products
    .filter(product => product.id !== draftProduct.id)
    .forEach(product => {
      const productSku = normalizeSkuValue(product.sku);
      if (productSku) {
        externalSkus.add(productSku);
      }

      product.variants.forEach(variant => {
        const variantSku = normalizeSkuValue(variant.sku);
        if (variantSku) {
          externalSkus.add(variantSku);
        }
      });
    });

  const primarySku = normalizeSkuValue(draftProduct.sku);
  if (primarySku && externalSkus.has(primarySku)) {
    errors.sku = 'Primary SKU must be unique across the catalog.';
  }

  const seenVariantSkus = new Map();
  const variantRows = {};

  draftProduct.variants.forEach(variant => {
    const rowErrors = {};
    const variantSku = normalizeSkuValue(variant.sku);

    if (!variantSku) {
      return;
    }

    if (externalSkus.has(variantSku)) {
      rowErrors.sku = 'SKU is already used by another product or variant.';
    } else if (seenVariantSkus.has(variantSku)) {
      rowErrors.sku = 'Variant SKUs must be unique within this product.';
    } else {
      seenVariantSkus.set(variantSku, variant.id);
    }

    if (primarySku && variantSku === primarySku && !(draftProduct.variants.length === 1 && variant.isDefault)) {
      rowErrors.sku = rowErrors.sku || 'This SKU matches the primary product SKU.';
    }

    if (Object.keys(rowErrors).length) {
      variantRows[variant.id] = rowErrors;
    }
  });

  if (Object.keys(variantRows).length) {
    errors.variants = errors.variants || 'Fix the highlighted variant fields before saving.';
    errors.variantRows = variantRows;
  }

  return errors;
}

function getComparableProduct(product) {
  if (!product) {
    return null;
  }

  return {
    id: product.id,
    title: product.title,
    description: product.description,
    status: product.status,
    category: product.category,
    tags: product.tags,
    vendor: product.vendor,
    sku: product.sku,
    basePrice: product.basePrice,
    compareAtPrice: product.compareAtPrice,
    featuredImageId: product.featuredImageId,
    images: (product.images || []).map(image => ({
      id: image.id,
      src: image.src,
      alt: image.alt,
      sortOrder: image.sortOrder,
    })),
    options: (product.options || []).map(option => ({
      id: option.id,
      name: option.name,
      values: option.values,
    })),
    variants: (product.variants || []).map(variant => ({
      id: variant.id,
      title: variant.title,
      optionValues: variant.optionValues,
      sku: variant.sku,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      inventoryQty: variant.inventoryQty,
      imageId: variant.imageId,
      isDefault: variant.isDefault,
      isActive: variant.isActive,
    })),
  };
}

function makeEditorState(product, mode = 'existing') {
  const resolvedProduct = product ? prepareProductForSave(product) : null;

  return {
    isOpen: Boolean(resolvedProduct),
    mode,
    draftProduct: resolvedProduct ? cloneProduct(resolvedProduct) : null,
    baselineProduct: resolvedProduct ? cloneProduct(resolvedProduct) : null,
    previewImageId: resolvedProduct?.featuredImageId || resolvedProduct?.images?.[0]?.id || null,
    autosaveEnabled: false,
    isSaving: false,
    validationErrors: {},
  };
}

function productReducer(state, action) {
  switch (action.type) {
    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        catalog: {
          ...state.catalog,
          searchQuery: action.value,
        },
      };
    case 'SET_ACTIVE_FILTER':
      return {
        ...state,
        catalog: {
          ...state.catalog,
          activeFilter: action.value,
        },
      };
    case 'OPEN_EDITOR':
      return {
        ...state,
        selectedProductId: action.selectedProductId,
        editor: {
          ...makeEditorState(action.product, action.mode),
          autosaveEnabled: state.editor.autosaveEnabled,
        },
      };
    case 'SET_DRAFT_STATE':
      return {
        ...state,
        editor: {
          ...state.editor,
          draftProduct: action.draftProduct,
          previewImageId: action.previewImageId,
          validationErrors: action.clearValidation ? {} : state.editor.validationErrors,
        },
      };
    case 'RESET_DRAFT':
      return {
        ...state,
        editor: {
          ...state.editor,
          draftProduct: state.editor.baselineProduct ? cloneProduct(state.editor.baselineProduct) : null,
          previewImageId:
            state.editor.baselineProduct?.featuredImageId ||
            state.editor.baselineProduct?.images?.[0]?.id ||
            null,
          validationErrors: {},
        },
      };
    case 'SET_AUTOSAVE':
      return {
        ...state,
        editor: {
          ...state.editor,
          autosaveEnabled: action.value,
        },
      };
    case 'SET_SAVING':
      return {
        ...state,
        editor: {
          ...state.editor,
          isSaving: action.value,
        },
      };
    case 'SET_VALIDATION_ERRORS':
      return {
        ...state,
        editor: {
          ...state.editor,
          validationErrors: action.errors,
        },
      };
    case 'COMMIT_PRODUCT': {
      const isExisting = state.products.some(product => product.id === action.product.id);
      const nextProducts = isExisting
        ? state.products.map(product => (product.id === action.product.id ? action.product : product))
        : [action.product, ...state.products];

      return {
        ...state,
        products: nextProducts,
        selectedProductId: action.product.id,
        editor: {
          ...makeEditorState(action.product, 'existing'),
          autosaveEnabled: state.editor.autosaveEnabled,
        },
      };
    }
    case 'DELETE_PRODUCT': {
      const nextProducts = state.products.filter(product => product.id !== action.productId);
      const fallbackProduct = nextProducts[0] || null;

      return {
        ...state,
        products: nextProducts,
        selectedProductId: fallbackProduct?.id || null,
        editor: fallbackProduct
          ? {
              ...makeEditorState(fallbackProduct, 'existing'),
              autosaveEnabled: state.editor.autosaveEnabled,
            }
          : {
              ...state.editor,
              isOpen: false,
              mode: 'new',
              draftProduct: null,
              baselineProduct: null,
              previewImageId: null,
              validationErrors: {},
              isSaving: false,
            },
      };
    }
    case 'CLOSE_EDITOR':
      return {
        ...state,
        editor: {
          ...state.editor,
          isOpen: false,
          draftProduct: null,
          baselineProduct: null,
          previewImageId: null,
          validationErrors: {},
          isSaving: false,
        },
      };
    case 'SET_CONFIRM_DIALOG':
      return {
        ...state,
        confirmDialog: action.dialog,
      };
    case 'CLEAR_CONFIRM_DIALOG':
      return {
        ...state,
        confirmDialog: null,
      };
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, action.toast],
      };
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter(toast => toast.id !== action.toastId),
      };
    default:
      return state;
  }
}

export function ProductProvider({ children }) {
  const [state, dispatch] = useReducer(productReducer, initialState);

  const selectedProduct = useMemo(
    () => state.products.find(product => product.id === state.selectedProductId) || null,
    [state.products, state.selectedProductId]
  );

  const draftInventorySummary = useMemo(
    () => deriveInventorySummary(state.editor.draftProduct?.variants || []),
    [state.editor.draftProduct]
  );

  const draftFeaturedImage = useMemo(() => {
    if (!state.editor.draftProduct) {
      return null;
    }

    return (
      state.editor.draftProduct.images.find(image => image.id === state.editor.draftProduct.featuredImageId) ||
      state.editor.draftProduct.images[0] ||
      null
    );
  }, [state.editor.draftProduct]);

  const hasUnsavedChanges = useMemo(() => {
    const comparableDraft = JSON.stringify(getComparableProduct(state.editor.draftProduct));
    const comparableBaseline = JSON.stringify(getComparableProduct(state.editor.baselineProduct));
    return comparableDraft !== comparableBaseline;
  }, [state.editor.baselineProduct, state.editor.draftProduct]);

  const draftValidation = useMemo(() => {
    if (!state.editor.draftProduct) {
      return {
        isValid: true,
        errors: {},
      };
    }

    const baseValidation = validateProduct(state.editor.draftProduct);
    const skuValidationErrors = collectSkuValidationErrors(state.editor.draftProduct, state.products);
    const errors = mergeValidationErrors(baseValidation.errors, skuValidationErrors);

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }, [state.editor.draftProduct, state.products]);

  const pushToast = (message, tone = 'success') => {
    const toastId = createEntityId('toast');

    dispatch({
      type: 'ADD_TOAST',
      toast: {
        id: toastId,
        message,
        tone,
      },
    });

    setTimeout(() => {
      dispatch({
        type: 'REMOVE_TOAST',
        toastId,
      });
    }, 3200);
  };

  const openExistingProduct = productId => {
    const product = state.products.find(item => item.id === productId);
    if (!product) {
      return;
    }

    const preparedProduct = prepareProductForSave(product);

    dispatch({
      type: 'OPEN_EDITOR',
      product: preparedProduct,
      mode: 'existing',
      selectedProductId: preparedProduct.id,
    });
  };

  const openNewProduct = () => {
    const draftProduct = createEmptyProductDraft();

    dispatch({
      type: 'OPEN_EDITOR',
      product: draftProduct,
      mode: 'new',
      selectedProductId: draftProduct.id,
    });
  };

  const setDraftState = (draftProduct, previewImageId, clearValidation = false) => {
    dispatch({
      type: 'SET_DRAFT_STATE',
      draftProduct,
      previewImageId,
      clearValidation,
    });
  };

  const updateDraftProduct = updater => {
    const currentDraft = state.editor.draftProduct;
    if (!currentDraft) {
      return;
    }

    const nextDraft = updater(cloneProduct(currentDraft));
    if (!nextDraft) {
      return;
    }

    const nextPreviewImageId =
      nextDraft.images?.find(image => image.id === state.editor.previewImageId)?.id ||
      nextDraft.featuredImageId ||
      nextDraft.images?.[0]?.id ||
      null;

    setDraftState(nextDraft, nextPreviewImageId);
  };

  const saveDraft = async ({ silent = false } = {}) => {
    if (!state.editor.draftProduct || state.editor.isSaving) {
      return false;
    }

    const preparedProduct = prepareProductForSave(state.editor.draftProduct);
    const preparedValidation = validateProduct(preparedProduct);
    const skuValidationErrors = collectSkuValidationErrors(preparedProduct, state.products);
    const mergedPreparedErrors = mergeValidationErrors(preparedValidation.errors, skuValidationErrors);

    if (Object.keys(mergedPreparedErrors).length) {
      dispatch({
        type: 'SET_VALIDATION_ERRORS',
        errors: mergedPreparedErrors,
      });

      if (!silent) {
        pushToast('Fix the highlighted product fields before saving.', 'error');
      }
      return false;
    }

    dispatch({ type: 'SET_SAVING', value: true });
    await new Promise(resolve => setTimeout(resolve, 120));
    dispatch({ type: 'COMMIT_PRODUCT', product: preparedProduct });

    if (!silent) {
      pushToast(`${preparedProduct.title} saved`, 'success');
    }

    return true;
  };

  const requestSelectProduct = productId => {
    openExistingProduct(productId);
  };

  const requestCreateProduct = () => {
    openNewProduct();
  };

  const requestCloseEditor = () => {
    dispatch({ type: 'CLOSE_EDITOR' });
  };

  const cancelDraftChanges = () => {
    if (state.editor.mode === 'new') {
      dispatch({ type: 'CLOSE_EDITOR' });
      pushToast('New product draft discarded', 'info');
      return;
    }

    dispatch({ type: 'RESET_DRAFT' });
    pushToast('Changes reverted', 'info');
  };

  const setSearchQuery = value => {
    dispatch({ type: 'SET_SEARCH_QUERY', value });
  };

  const setActiveFilter = value => {
    dispatch({ type: 'SET_ACTIVE_FILTER', value });
  };

  const setAutosaveEnabled = value => {
    dispatch({ type: 'SET_AUTOSAVE', value });
    pushToast(value ? 'Autosave enabled' : 'Autosave disabled', 'info');
  };

  const setDraftField = (field, value) => {
    updateDraftProduct(draftProduct => {
      const nextDraft = {
        ...draftProduct,
        [field]: value,
      };

      const hasOnlyDefaultVariant =
        !draftProduct.options.length &&
        draftProduct.variants.length === 1 &&
        draftProduct.variants[0]?.isDefault;

      if (hasOnlyDefaultVariant && ['sku', 'basePrice', 'compareAtPrice'].includes(field)) {
        nextDraft.variants = draftProduct.variants.map(variant => ({
          ...variant,
          sku: field === 'sku' ? value : variant.sku,
          price: field === 'basePrice' ? value : variant.price,
          compareAtPrice: field === 'compareAtPrice' ? value : variant.compareAtPrice,
        }));
      }

      return nextDraft;
    });
  };

  const setDraftTagsFromText = value => {
    const tags = value
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);

    setDraftField('tags', tags);
  };

  const selectPreviewImage = imageId => {
    dispatch({
      type: 'SET_DRAFT_STATE',
      draftProduct: state.editor.draftProduct,
      previewImageId: imageId,
      clearValidation: false,
    });
  };

  const addSampleImage = () => {
    updateDraftProduct(draftProduct => {
      const lastImage = draftProduct.images[draftProduct.images.length - 1];
      const nextImage = createImageAsset(
        getNextSampleImage(lastImage?.src),
        `${draftProduct.title || 'Product'} image ${draftProduct.images.length + 1}`,
        draftProduct.images.length
      );
      const mediaState = ensureMediaState(
        [...draftProduct.images, nextImage],
        draftProduct.featuredImageId || nextImage.id
      );

      pushToast('Sample image added', 'success');

      return {
        ...draftProduct,
        images: mediaState.images,
        featuredImageId: mediaState.featuredImageId,
      };
    });
  };

  const addImagesFromFiles = fileList => {
    const files = Array.from(fileList || []);
    if (!files.length) {
      return;
    }

    updateDraftProduct(draftProduct => {
      const uploadedImages = files.map((file, index) =>
        createImageAsset(
          URL.createObjectURL(file),
          file.name || `${draftProduct.title || 'Product'} image ${draftProduct.images.length + index + 1}`,
          draftProduct.images.length + index
        )
      );
      const mediaState = ensureMediaState(
        [...draftProduct.images, ...uploadedImages],
        draftProduct.featuredImageId || uploadedImages[0]?.id || null
      );

      pushToast(`${uploadedImages.length} image${uploadedImages.length > 1 ? 's' : ''} added`, 'success');

      return {
        ...draftProduct,
        images: mediaState.images,
        featuredImageId: mediaState.featuredImageId,
      };
    });
  };

  const replaceImageWithSample = imageId => {
    updateDraftProduct(draftProduct => ({
      ...draftProduct,
      images: draftProduct.images.map(image =>
        image.id === imageId
          ? {
              ...image,
              src: getNextSampleImage(image.src),
            }
          : image
      ),
    }));
  };

  const replaceImageWithFile = (imageId, file) => {
    if (!file) {
      return;
    }

    updateDraftProduct(draftProduct => ({
      ...draftProduct,
      images: draftProduct.images.map(image =>
        image.id === imageId
          ? {
              ...image,
              src: URL.createObjectURL(file),
              alt: file.name || image.alt,
            }
          : image
      ),
    }));
  };

  const setFeaturedImage = imageId => {
    updateDraftProduct(draftProduct => {
      const mediaState = ensureMediaState(draftProduct.images, imageId);
      return {
        ...draftProduct,
        images: mediaState.images,
        featuredImageId: mediaState.featuredImageId,
      };
    });
  };

  const moveImage = (imageId, direction) => {
    updateDraftProduct(draftProduct => {
      const nextImages = reorderImage(draftProduct.images, imageId, direction);
      const mediaState = ensureMediaState(nextImages, draftProduct.featuredImageId);
      return {
        ...draftProduct,
        images: mediaState.images,
        featuredImageId: mediaState.featuredImageId,
      };
    });
  };

  const removeImage = imageId => {
    updateDraftProduct(draftProduct => {
      const nextImages = draftProduct.images.filter(image => image.id !== imageId);
      const mediaState = ensureMediaState(
        nextImages,
        draftProduct.featuredImageId === imageId ? null : draftProduct.featuredImageId
      );
      const nextVariants = draftProduct.variants.map(variant => ({
        ...variant,
        imageId: variant.imageId === imageId ? mediaState.featuredImageId : variant.imageId,
      }));

      return {
        ...draftProduct,
        images: mediaState.images,
        featuredImageId: mediaState.featuredImageId,
        variants: nextVariants,
      };
    });
  };

  const addOptionGroup = () => {
    updateDraftProduct(draftProduct => ({
      ...draftProduct,
      options: [
        ...draftProduct.options,
        {
          id: createEntityId('option'),
          name: '',
          values: [],
        },
      ],
    }));
  };

  const removeOptionGroup = optionId => {
    updateDraftProduct(draftProduct => {
      const nextOptions = draftProduct.options.filter(option => option.id !== optionId);
      const cleanOptions = sanitizeOptions(nextOptions);
      const nextVariants = generateVariantsFromOptions(draftProduct, cleanOptions, draftProduct.variants);

      return {
        ...draftProduct,
        options: nextOptions,
        variants: nextVariants,
      };
    });
  };

  const updateOptionName = (optionId, value) => {
    updateDraftProduct(draftProduct => {
      const nextOptions = draftProduct.options.map(option =>
        option.id === optionId
          ? {
              ...option,
              name: value,
            }
          : option
      );
      const cleanOptions = sanitizeOptions(nextOptions);
      const nextVariants = generateVariantsFromOptions(draftProduct, cleanOptions, draftProduct.variants);

      return {
        ...draftProduct,
        options: nextOptions,
        variants: nextVariants,
      };
    });
  };

  const updateOptionValues = (optionId, valueText) => {
    updateDraftProduct(draftProduct => {
      const values = valueText
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

      const nextOptions = draftProduct.options.map(option =>
        option.id === optionId
          ? {
              ...option,
              values,
            }
          : option
      );
      const cleanOptions = sanitizeOptions(nextOptions);
      const nextVariants = generateVariantsFromOptions(draftProduct, cleanOptions, draftProduct.variants);

      return {
        ...draftProduct,
        options: nextOptions,
        variants: nextVariants,
      };
    });
  };

  const addVariant = () => {
    const draftProduct = state.editor.draftProduct;
    if (!draftProduct) {
      return;
    }

    if (!draftProduct.options.length) {
      pushToast('Add an option group like Size or Color to create more variants.', 'info');
      return;
    }

    const missingCombos = getMissingVariantCombos(draftProduct.options, draftProduct.variants);
    if (!missingCombos.length) {
      pushToast('All current option combinations already exist. Add a new option value to create another variant.', 'info');
      return;
    }

    updateDraftProduct(nextDraft => {
      const optionNames = sanitizeOptions(nextDraft.options).map(option => option.name);
      const combo = missingCombos[0];
      const nextVariant = {
        id: createEntityId('variant'),
        title: buildVariantTitle(combo, optionNames),
        optionValues: combo,
        sku: `${nextDraft.sku || 'SKU'}-${nextDraft.variants.length + 1}`,
        price: nextDraft.basePrice,
        compareAtPrice: nextDraft.compareAtPrice,
        inventoryQty: 0,
        imageId: nextDraft.featuredImageId || null,
        isDefault: false,
        isActive: true,
      };

      return {
        ...nextDraft,
        variants: [...nextDraft.variants, nextVariant],
      };
    });
  };

  const updateVariantField = (variantId, field, value) => {
    updateDraftProduct(draftProduct => ({
      ...draftProduct,
      variants: draftProduct.variants.map(variant =>
        variant.id === variantId
          ? {
              ...variant,
              [field]: value,
            }
          : variant
      ),
    }));
  };

  const deleteVariant = variantId => {
    updateDraftProduct(draftProduct => {
      const nextVariants = draftProduct.variants.filter(variant => variant.id !== variantId);

      if (!nextVariants.length) {
        const fallbackVariant = createDefaultVariantForProduct({
          ...draftProduct,
          inventorySummary: {
            totalAvailable: 0,
          },
        });
        return {
          ...draftProduct,
          options: [],
          variants: [fallbackVariant],
        };
      }

      const nextOptions = syncOptionsWithVariants(draftProduct.options, nextVariants);

      return {
        ...draftProduct,
        options: nextOptions,
        variants: nextVariants,
      };
    });
  };

  const requestDeleteVariant = variantId => {
    const variant = state.editor.draftProduct?.variants.find(item => item.id === variantId);
    if (!variant) {
      return;
    }

    dispatch({
      type: 'SET_CONFIRM_DIALOG',
      dialog: {
        kind: 'delete-variant',
        variantId,
        title: 'Delete this variant?',
        description: `Remove ${variant.title} from the product. You can re-create it later from the option matrix if needed.`,
      },
    });
  };

  const requestDeleteProduct = () => {
    const product = state.editor.draftProduct || selectedProduct;
    if (!product) {
      return;
    }

    dispatch({
      type: 'SET_CONFIRM_DIALOG',
      dialog: {
        kind: 'delete-product',
        productId: product.id,
        title: state.editor.mode === 'new' ? 'Discard this new product?' : 'Delete this product?',
        description:
          state.editor.mode === 'new'
            ? 'This draft has not been saved yet. Discard it and close the drawer?'
            : `${product.title} will be removed from the catalog immediately.`,
      },
    });
  };

  const confirmDialogAction = resolution => {
    const dialog = state.confirmDialog;
    if (!dialog) {
      return;
    }

    if (dialog.kind === 'delete-product' && resolution === 'confirm') {
      dispatch({ type: 'CLEAR_CONFIRM_DIALOG' });

      if (state.editor.mode === 'new') {
        dispatch({ type: 'CLOSE_EDITOR' });
        pushToast('New product draft discarded', 'info');
        return;
      }

      dispatch({ type: 'DELETE_PRODUCT', productId: dialog.productId });
      pushToast('Product deleted', 'success');
      return;
    }

    if (dialog.kind === 'delete-variant' && resolution === 'confirm') {
      dispatch({ type: 'CLEAR_CONFIRM_DIALOG' });
      deleteVariant(dialog.variantId);
      return;
    }

    dispatch({ type: 'CLEAR_CONFIRM_DIALOG' });
  };

  const dismissConfirmDialog = () => {
    dispatch({ type: 'CLEAR_CONFIRM_DIALOG' });
  };

  const dismissToast = toastId => {
    dispatch({ type: 'REMOVE_TOAST', toastId });
  };

  const value = {
    products: state.products,
    selectedProductId: state.selectedProductId,
    selectedProduct,
    searchQuery: state.catalog.searchQuery,
    activeFilter: state.catalog.activeFilter,
    editor: {
      ...state.editor,
      draftInventorySummary,
      draftFeaturedImage,
      hasUnsavedChanges,
      isDraftValid: draftValidation.isValid,
      validationErrors: draftValidation.errors,
    },
    confirmDialog: state.confirmDialog,
    toasts: state.toasts,
    formatMoney,
    actions: {
      setSearchQuery,
      setActiveFilter,
      requestSelectProduct,
      requestCreateProduct,
      requestCloseEditor,
      cancelDraftChanges,
      saveDraft,
      setAutosaveEnabled,
      setDraftField,
      setDraftTagsFromText,
      addSampleImage,
      addImagesFromFiles,
      replaceImageWithSample,
      replaceImageWithFile,
      selectPreviewImage,
      setFeaturedImage,
      moveImage,
      removeImage,
      addOptionGroup,
      removeOptionGroup,
      updateOptionName,
      updateOptionValues,
      addVariant,
      updateVariantField,
      requestDeleteVariant,
      requestDeleteProduct,
      confirmDialogAction,
      dismissConfirmDialog,
      dismissToast,
      showToast: pushToast,
    },
  };

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProductStore() {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProductStore must be used within ProductProvider');
  }

  return context;
}
