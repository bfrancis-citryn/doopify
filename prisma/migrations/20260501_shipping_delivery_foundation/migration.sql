DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShippingProviderUsage') THEN
    CREATE TYPE "ShippingProviderUsage" AS ENUM ('LIVE_AND_LABELS', 'LABELS_ONLY', 'LIVE_RATES_ONLY');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShippingPackageType') THEN
    CREATE TYPE "ShippingPackageType" AS ENUM ('BOX', 'POLY_MAILER', 'ENVELOPE', 'CUSTOM');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShippingDimensionUnit') THEN
    CREATE TYPE "ShippingDimensionUnit" AS ENUM ('IN', 'CM');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShippingWeightUnit') THEN
    CREATE TYPE "ShippingWeightUnit" AS ENUM ('OZ', 'LB', 'G', 'KG');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShippingManualRateType') THEN
    CREATE TYPE "ShippingManualRateType" AS ENUM ('FLAT', 'FREE', 'WEIGHT_BASED', 'PRICE_BASED');
  END IF;
END
$$;

ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "shippingProviderUsage" "ShippingProviderUsage" NOT NULL DEFAULT 'LIVE_AND_LABELS';

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "shippingMethodName" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingRateType" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingProviderRateId" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedDeliveryText" TEXT;

CREATE TABLE IF NOT EXISTS "shipping_packages" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ShippingPackageType" NOT NULL DEFAULT 'BOX',
  "length" DOUBLE PRECISION NOT NULL,
  "width" DOUBLE PRECISION NOT NULL,
  "height" DOUBLE PRECISION NOT NULL,
  "dimensionUnit" "ShippingDimensionUnit" NOT NULL DEFAULT 'IN',
  "emptyPackageWeight" DOUBLE PRECISION NOT NULL,
  "weightUnit" "ShippingWeightUnit" NOT NULL DEFAULT 'OZ',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shipping_packages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "shipping_locations" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "company" TEXT,
  "address1" TEXT NOT NULL,
  "address2" TEXT,
  "city" TEXT NOT NULL,
  "stateProvince" TEXT,
  "postalCode" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "phone" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shipping_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "shipping_manual_rates" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "regionCountry" TEXT,
  "regionStateProvince" TEXT,
  "rateType" "ShippingManualRateType" NOT NULL DEFAULT 'FLAT',
  "amountCents" INTEGER NOT NULL,
  "minWeight" DOUBLE PRECISION,
  "maxWeight" DOUBLE PRECISION,
  "minSubtotalCents" INTEGER,
  "maxSubtotalCents" INTEGER,
  "freeOverAmountCents" INTEGER,
  "estimatedDeliveryText" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shipping_manual_rates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "shipping_fallback_rates" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "regionCountry" TEXT,
  "regionStateProvince" TEXT,
  "amountCents" INTEGER NOT NULL,
  "estimatedDeliveryText" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shipping_fallback_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "shipping_packages_storeId_isActive_idx" ON "shipping_packages"("storeId", "isActive");
CREATE INDEX IF NOT EXISTS "shipping_locations_storeId_isActive_idx" ON "shipping_locations"("storeId", "isActive");
CREATE INDEX IF NOT EXISTS "shipping_manual_rates_storeId_isActive_idx" ON "shipping_manual_rates"("storeId", "isActive");
CREATE INDEX IF NOT EXISTS "shipping_fallback_rates_storeId_isActive_idx" ON "shipping_fallback_rates"("storeId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'shipping_packages_storeId_fkey'
      AND table_name = 'shipping_packages'
  ) THEN
    ALTER TABLE "shipping_packages"
      ADD CONSTRAINT "shipping_packages_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'shipping_locations_storeId_fkey'
      AND table_name = 'shipping_locations'
  ) THEN
    ALTER TABLE "shipping_locations"
      ADD CONSTRAINT "shipping_locations_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'shipping_manual_rates_storeId_fkey'
      AND table_name = 'shipping_manual_rates'
  ) THEN
    ALTER TABLE "shipping_manual_rates"
      ADD CONSTRAINT "shipping_manual_rates_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'shipping_fallback_rates_storeId_fkey'
      AND table_name = 'shipping_fallback_rates'
  ) THEN
    ALTER TABLE "shipping_fallback_rates"
      ADD CONSTRAINT "shipping_fallback_rates_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;