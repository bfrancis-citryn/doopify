ALTER TABLE "stores"
  RENAME COLUMN "shippingThreshold" TO "shippingThresholdCents";

ALTER TABLE "stores"
  RENAME COLUMN "shippingDomesticRate" TO "shippingDomesticRateCents";

ALTER TABLE "stores"
  RENAME COLUMN "shippingInternationalRate" TO "shippingInternationalRateCents";

ALTER TABLE "shipping_rates"
  RENAME COLUMN "amount" TO "amountCents";

ALTER TABLE "shipping_rates"
  RENAME COLUMN "minSubtotal" TO "minSubtotalCents";

ALTER TABLE "shipping_rates"
  RENAME COLUMN "maxSubtotal" TO "maxSubtotalCents";

ALTER TABLE "product_variants"
  RENAME COLUMN "price" TO "priceCents";

ALTER TABLE "product_variants"
  RENAME COLUMN "compareAtPrice" TO "compareAtPriceCents";

ALTER TABLE "customers"
  RENAME COLUMN "totalSpent" TO "totalSpentCents";

ALTER TABLE "orders"
  RENAME COLUMN "subtotal" TO "subtotalCents";

ALTER TABLE "orders"
  RENAME COLUMN "taxAmount" TO "taxAmountCents";

ALTER TABLE "orders"
  RENAME COLUMN "shippingAmount" TO "shippingAmountCents";

ALTER TABLE "orders"
  RENAME COLUMN "discountAmount" TO "discountAmountCents";

ALTER TABLE "orders"
  RENAME COLUMN "total" TO "totalCents";

ALTER TABLE "order_items"
  RENAME COLUMN "price" TO "priceCents";

ALTER TABLE "order_items"
  RENAME COLUMN "totalDiscount" TO "totalDiscountCents";

ALTER TABLE "order_items"
  RENAME COLUMN "total" TO "totalCents";

ALTER TABLE "payments"
  RENAME COLUMN "amount" TO "amountCents";

ALTER TABLE "checkout_sessions"
  RENAME COLUMN "subtotal" TO "subtotalCents";

ALTER TABLE "checkout_sessions"
  RENAME COLUMN "taxAmount" TO "taxAmountCents";

ALTER TABLE "checkout_sessions"
  RENAME COLUMN "shippingAmount" TO "shippingAmountCents";

ALTER TABLE "checkout_sessions"
  RENAME COLUMN "discountAmount" TO "discountAmountCents";

ALTER TABLE "checkout_sessions"
  RENAME COLUMN "total" TO "totalCents";

ALTER TABLE "refunds"
  RENAME COLUMN "amount" TO "amountCents";

ALTER TABLE "refund_items"
  RENAME COLUMN "amount" TO "amountCents";

ALTER TABLE "discounts"
  RENAME COLUMN "minimumOrder" TO "minimumOrderCents";

ALTER TABLE "discount_applications"
  RENAME COLUMN "amount" TO "amountCents";
