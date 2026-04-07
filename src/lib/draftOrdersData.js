export function createDraftOrderSeed(products, customers, discounts) {
  return {
    id: `draft_${Date.now()}`,
    customerId: customers[0]?.id || '',
    lineItems: products.slice(0, 2).map((product, index) => ({
      id: `draft_item_${index + 1}`,
      productId: product.id,
      title: product.title,
      variantTitle: product.variants?.[0]?.title || 'Default',
      quantity: 1,
      price: Number(product.basePrice || 0),
    })),
    discountId: discounts[0]?.id || '',
    shippingAmount: 12,
    notes: '',
    status: 'draft',
  };
}

export function calculateDraftTotals(draftOrder, discounts = []) {
  const subtotal = draftOrder.lineItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const selectedDiscount = discounts.find(discount => discount.id === draftOrder.discountId) || null;
  let discountAmount = 0;

  if (selectedDiscount) {
    if (selectedDiscount.method === 'free shipping') {
      discountAmount = Number(draftOrder.shippingAmount || 0);
    } else if (selectedDiscount.valueType === 'fixed') {
      discountAmount = Number(selectedDiscount.value || 0);
    } else {
      const percentage = Number(selectedDiscount.value || 0);
      discountAmount = subtotal * (percentage / 100);
    }
  }

  const shipping = Number(draftOrder.shippingAmount || 0);
  const total = Math.max(0, subtotal + shipping - discountAmount);

  return {
    subtotal,
    shipping,
    discountAmount,
    total,
  };
}
