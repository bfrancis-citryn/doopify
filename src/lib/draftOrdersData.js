import { calculateShipping, calculateTax } from '@/lib/checkout/pricing';

function toCents(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
}

function toDollars(cents) {
  return Number((Math.max(0, Number(cents || 0)) / 100).toFixed(2));
}

function toMoneyNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function resolveVariantForProduct(product, variantId) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;
  return variants.find((entry) => entry.id === variantId) || variants[0];
}

function resolveImageSnapshot(product, variant) {
  const images = Array.isArray(product?.images) ? product.images : [];
  const preferredImageId = variant?.imageId || product?.featuredImageId || null;
  const matchedImage = preferredImageId
    ? images.find((image) => image.id === preferredImageId)
    : null;
  const image = matchedImage || images[0] || null;
  return {
    imageUrl: image?.url || image?.src || null,
    imageAlt: image?.altText || image?.alt || product?.title || '',
  };
}

export function createDraftOrderSeed(products, customers, discounts) {
  const firstProduct = products[0];
  const firstLineItem = firstProduct ? createDraftLineItemFromProduct(firstProduct) : null;

  return {
    id: `draft_${Date.now()}`,
    customerMode: customers.length ? 'existing' : 'guest',
    customerId: customers[0]?.id || '',
    manualCustomer: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      shippingAddress: '',
      billingAddress: '',
    },
    lineItems: firstLineItem ? [{ ...firstLineItem, id: 'draft_item_1' }] : [],
    discountId: discounts[0]?.id || '',
    customDiscountAmount: 0,
    shippingAmount: '',
    taxAmount: '',
    notes: '',
    paymentStatus: 'pending',
    status: 'draft',
  };
}

export function createDraftLineItemFromProduct(product, variantId) {
  const variant = resolveVariantForProduct(product, variantId);
  const { imageUrl, imageAlt } = resolveImageSnapshot(product, variant);

  return {
    id: `draft_item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    productId: product?.id || null,
    variantId: variant?.id || null,
    title: product?.title || 'Untitled product',
    variantTitle: variant?.title || 'Default',
    sku: variant?.sku || '',
    imageUrl,
    imageAlt,
    quantity: 1,
    price: toMoneyNumber(variant?.price, toMoneyNumber(product?.basePrice, 0)),
    compareAtPrice:
      variant?.compareAtPrice != null
        ? toMoneyNumber(variant.compareAtPrice, 0)
        : product?.compareAtPrice != null
          ? toMoneyNumber(product.compareAtPrice, 0)
          : null,
    taxable: variant?.taxable ?? product?.taxable ?? true,
    shippable: variant?.shippable ?? product?.shippable ?? true,
  };
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

export function validateManualDraftCustomer(manualCustomer) {
  const normalized = {
    firstName: normalizeText(manualCustomer?.firstName),
    lastName: normalizeText(manualCustomer?.lastName),
    email: normalizeEmail(manualCustomer?.email),
    phone: normalizeText(manualCustomer?.phone),
    shippingAddress: normalizeText(manualCustomer?.shippingAddress),
    billingAddress: normalizeText(manualCustomer?.billingAddress),
  };

  const errors = {};

  if (!normalized.email) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
    errors.email = 'Enter a valid email address.';
  }

  return {
    normalized,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

export function resolveDraftLineItemDisplay(item, products = []) {
  const product = (products || []).find((entry) => entry.id === item?.productId) || null;
  const variant = resolveVariantForProduct(product, item?.variantId);
  const catalogSnapshot = product ? createDraftLineItemFromProduct(product, variant?.id || null) : null;

  return {
    product,
    variant,
    productMissing: !product,
    variantMissing: Boolean(product) && !variant,
    productId: item?.productId || catalogSnapshot?.productId || null,
    variantId: item?.variantId || catalogSnapshot?.variantId || null,
    title: item?.title || catalogSnapshot?.title || 'Untitled product',
    variantTitle: item?.variantTitle || catalogSnapshot?.variantTitle || 'Default',
    sku: item?.sku || catalogSnapshot?.sku || '',
    imageUrl: item?.imageUrl || catalogSnapshot?.imageUrl || null,
    imageAlt: item?.imageAlt || catalogSnapshot?.imageAlt || '',
    price:
      item?.price == null
        ? toMoneyNumber(catalogSnapshot?.price, 0)
        : toMoneyNumber(item.price, 0),
    compareAtPrice:
      item?.compareAtPrice == null
        ? catalogSnapshot?.compareAtPrice ?? null
        : toMoneyNumber(item.compareAtPrice, 0),
    quantity: Math.max(1, Number(item?.quantity || 1)),
    taxable: item?.taxable ?? catalogSnapshot?.taxable ?? true,
    shippable: item?.shippable ?? catalogSnapshot?.shippable ?? true,
  };
}

export function calculateDraftTotals(draftOrder, discounts = [], settings = {}) {
  const subtotal = draftOrder.lineItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const selectedDiscount = discounts.find(discount => discount.id === draftOrder.discountId) || null;
  const subtotalCents = toCents(subtotal);
  const customDiscountAmountCents = toCents(draftOrder.customDiscountAmount);
  let discountAmountCents = customDiscountAmountCents;

  if (selectedDiscount) {
    if (selectedDiscount.method === 'free shipping') {
      // Free shipping is applied after rate selection below.
    } else if (selectedDiscount.valueType === 'fixed') {
      discountAmountCents += toCents(selectedDiscount.value);
    } else {
      const percentage = Number(selectedDiscount.value || 0);
      discountAmountCents += Math.round(subtotalCents * (percentage / 100));
    }
  }

  const taxableSubtotalCents = Math.max(0, subtotalCents - discountAmountCents);
  const shippingDecision = calculateShipping({
    subtotalCents: taxableSubtotalCents,
    shippingThresholdCents:
      settings.freeShippingThreshold == null || settings.freeShippingThreshold === ''
        ? null
        : toCents(settings.freeShippingThreshold),
    shippingAddress: {
      country: settings.taxOriginCountry || 'US',
      province: settings.taxOriginState || '',
    },
    storeCountry: settings.taxOriginCountry || 'US',
    shippingRates: {
      domesticCents: toCents(settings.domesticShippingRate),
      internationalCents: toCents(settings.internationalShippingRate),
    },
  });

  const computedShippingCents = shippingDecision.amountCents;
  const shippingCents =
    draftOrder.shippingAmount == null || draftOrder.shippingAmount === ''
      ? computedShippingCents
      : toCents(draftOrder.shippingAmount);
  if (selectedDiscount?.method === 'free shipping') {
    discountAmountCents += shippingCents;
  }

  const computedTax = calculateTax({
    taxableSubtotalCents,
    shippingAmountCents: selectedDiscount?.method === 'free shipping' ? 0 : shippingCents,
    shippingAddress: {
      country: settings.taxOriginCountry || 'US',
      province: settings.taxOriginState || '',
    },
    storeCountry: settings.taxOriginCountry || 'US',
    taxRates: {
      domestic: Number(settings.domesticTaxRate || 0) / 100,
      international: Number(settings.internationalTaxRate || 0) / 100,
    },
    taxSettings: {
      enabled: Boolean(settings.taxEnabled),
      strategy: settings.taxStrategy || 'NONE',
      defaultTaxRateBps: Math.max(0, Math.round(Number(settings.defaultTaxRatePercent || 0) * 100)),
      taxShipping: Boolean(settings.taxShipping),
      pricesIncludeTax: Boolean(settings.pricesIncludeTax),
    },
  });

  const taxCents =
    draftOrder.taxAmount == null || draftOrder.taxAmount === ''
      ? computedTax.amountCents
      : toCents(draftOrder.taxAmount);
  const pricesIncludeTax = Boolean(settings.taxEnabled && settings.pricesIncludeTax);
  const totalCents = pricesIncludeTax
    ? Math.max(0, subtotalCents + shippingCents - discountAmountCents)
    : Math.max(0, subtotalCents + shippingCents + taxCents - discountAmountCents);

  return {
    subtotal: toDollars(subtotalCents),
    shipping: toDollars(shippingCents),
    tax: toDollars(taxCents),
    discountAmount: toDollars(discountAmountCents),
    total: toDollars(totalCents),
  };
}

export function convertDraftOrderToOrder(draftOrder, customer, discounts, existingOrderCount = 0, settings = {}) {
  const totals = calculateDraftTotals(draftOrder, discounts, settings);
  const selectedDiscount = discounts.find(discount => discount.id === draftOrder.discountId) || null;
  const orderNumber = `#${1000 + existingOrderCount + 1}`;
  const createdAt = new Date().toISOString();

  return {
    id: `ord_${Date.now()}`,
    orderNumber,
    createdAt,
    customer: {
      name: customer?.name || 'Guest Customer',
      email: customer?.email || 'guest@example.com',
    },
    channel: 'Draft Orders',
    total: totals.total,
    itemCount: draftOrder.lineItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    paymentStatus: draftOrder.paymentStatus,
    fulfillmentStatus: 'unfulfilled',
    deliveryStatus: 'not-shipped',
    returnStatus: 'none',
    deliveryMethod: 'Custom shipping',
    tags: selectedDiscount ? ['Draft converted', selectedDiscount.title] : ['Draft converted'],
    riskLevel: 'low',
    trackingNumber: '',
    carrier: 'Not assigned',
    location: 'Primary warehouse',
    shippingAddress: customer?.defaultAddress || 'No address on file',
    billingAddress: customer?.defaultAddress || 'No address on file',
    notes: draftOrder.notes,
    timeline: [
      {
        id: `timeline-${Date.now()}`,
        event: 'Draft converted',
        detail: 'Draft order was converted into a live order.',
        createdAt,
      },
    ],
    lineItems: draftOrder.lineItems.map(item => ({
      id: item.id,
      productId: item.productId || null,
      variantId: item.variantId || null,
      title: item.title,
      variant: item.variantTitle,
      variantTitle: item.variantTitle,
      sku: item.sku || '',
      imageUrl: item.imageUrl || null,
      quantity: item.quantity,
      price: item.price,
      compareAtPrice: item.compareAtPrice ?? null,
      taxable: item.taxable ?? true,
      shippable: item.shippable ?? true,
    })),
  };
}
