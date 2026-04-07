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
    shippingAmount: 12,
    taxAmount: 0,
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

export function calculateDraftTotals(draftOrder, discounts = []) {
  const subtotal = draftOrder.lineItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const selectedDiscount = discounts.find(discount => discount.id === draftOrder.discountId) || null;
  const shipping = Number(draftOrder.shippingAmount || 0);
  const tax = Number(draftOrder.taxAmount || 0);
  const customDiscountAmount = Number(draftOrder.customDiscountAmount || 0);
  let discountAmount = customDiscountAmount;

  if (selectedDiscount) {
    if (selectedDiscount.method === 'free shipping') {
      discountAmount += shipping;
    } else if (selectedDiscount.valueType === 'fixed') {
      discountAmount += Number(selectedDiscount.value || 0);
    } else {
      const percentage = Number(selectedDiscount.value || 0);
      discountAmount += subtotal * (percentage / 100);
    }
  }

  const total = Math.max(0, subtotal + shipping + tax - discountAmount);

  return {
    subtotal,
    shipping,
    tax,
    discountAmount,
    total,
  };
}

export function convertDraftOrderToOrder(draftOrder, customer, discounts, existingOrderCount = 0) {
  const totals = calculateDraftTotals(draftOrder, discounts);
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
