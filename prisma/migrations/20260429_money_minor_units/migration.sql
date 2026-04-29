ALTER TABLE "stores"
  ALTER COLUMN "shippingThreshold" TYPE INTEGER USING ROUND("shippingThreshold" * 100)::INTEGER,
  ALTER COLUMN "shippingDomesticRate" TYPE INTEGER USING ROUND("shippingDomesticRate" * 100)::INTEGER,
  ALTER COLUMN "shippingInternationalRate" TYPE INTEGER USING ROUND("shippingInternationalRate" * 100)::INTEGER,
  ALTER COLUMN "shippingDomesticRate" SET DEFAULT 999,
  ALTER COLUMN "shippingInternationalRate" SET DEFAULT 1999;

ALTER TABLE "shipping_rates"
  ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER,
  ALTER COLUMN "minSubtotal" TYPE INTEGER USING ROUND("minSubtotal" * 100)::INTEGER,
  ALTER COLUMN "maxSubtotal" TYPE INTEGER USING ROUND("maxSubtotal" * 100)::INTEGER;

ALTER TABLE "product_variants"
  ALTER COLUMN "price" TYPE INTEGER USING ROUND("price" * 100)::INTEGER,
  ALTER COLUMN "compareAtPrice" TYPE INTEGER USING ROUND("compareAtPrice" * 100)::INTEGER;

ALTER TABLE "customers"
  ALTER COLUMN "totalSpent" TYPE INTEGER USING ROUND("totalSpent" * 100)::INTEGER;

ALTER TABLE "orders"
  ALTER COLUMN "subtotal" TYPE INTEGER USING ROUND("subtotal" * 100)::INTEGER,
  ALTER COLUMN "taxAmount" TYPE INTEGER USING ROUND("taxAmount" * 100)::INTEGER,
  ALTER COLUMN "shippingAmount" TYPE INTEGER USING ROUND("shippingAmount" * 100)::INTEGER,
  ALTER COLUMN "discountAmount" TYPE INTEGER USING ROUND("discountAmount" * 100)::INTEGER,
  ALTER COLUMN "total" TYPE INTEGER USING ROUND("total" * 100)::INTEGER;

ALTER TABLE "order_items"
  ALTER COLUMN "price" TYPE INTEGER USING ROUND("price" * 100)::INTEGER,
  ALTER COLUMN "totalDiscount" TYPE INTEGER USING ROUND("totalDiscount" * 100)::INTEGER,
  ALTER COLUMN "total" TYPE INTEGER USING ROUND("total" * 100)::INTEGER;

ALTER TABLE "payments"
  ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER;

ALTER TABLE "checkout_sessions"
  ALTER COLUMN "subtotal" TYPE INTEGER USING ROUND("subtotal" * 100)::INTEGER,
  ALTER COLUMN "taxAmount" TYPE INTEGER USING ROUND("taxAmount" * 100)::INTEGER,
  ALTER COLUMN "shippingAmount" TYPE INTEGER USING ROUND("shippingAmount" * 100)::INTEGER,
  ALTER COLUMN "discountAmount" TYPE INTEGER USING ROUND("discountAmount" * 100)::INTEGER,
  ALTER COLUMN "total" TYPE INTEGER USING ROUND("total" * 100)::INTEGER;

ALTER TABLE "refunds"
  ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER;

ALTER TABLE "refund_items"
  ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER;

ALTER TABLE "discounts"
  ALTER COLUMN "value" TYPE INTEGER USING ROUND("value" * 100)::INTEGER,
  ALTER COLUMN "minimumOrder" TYPE INTEGER USING ROUND("minimumOrder" * 100)::INTEGER;

ALTER TABLE "discount_applications"
  ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER;
