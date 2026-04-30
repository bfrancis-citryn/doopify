import { calculateShipping, calculateTax } from '@/server/checkout/pricing';

function toCents(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
}

function toDollars(cents) {
  return Number((Math.max(0, Number(cents || 0)) / 100).toFixed(2));
}

export function createDraftOrderSeed(products, customers, discounts) {
  const firstProduct = products[0];
  const firstVariant = firstProduct?.variants?.[0];

  return {
    id: `draft_${Date.now()}`,
    customerId: customers[0]?.id || '',
    lineItems: firstProduct
      ? [
          {
            id: `draft_item_1`,
            productId: firstProduct.id,
            variantId: firstVariant?.id || null,
            title: firstProduct.title,
            variantTitle: firstVariant?.title || 'Default',
            quantity: 1,
            price: Number(firstVariant?.price ?? firstProduct.basePrice ?? 0),
          },
        ]
      : [],
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
  const variant = product?.variants?.find(entry => entry.id === variantId) || product?.variants?.[0] || null;

  return {
    id: `draft_item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    productId: product.id,
    variantId: variant?.id || null,
    title: product.title,
    variantTitle: variant?.title || 'Default',
    quantity: 1,
    price: Number(variant?.price ?? product.basePrice ?? 0),
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
      title: item.title,
      variant: item.variantTitle,
      quantity: item.quantity,
      price: item.price,
    })),
  };
}
