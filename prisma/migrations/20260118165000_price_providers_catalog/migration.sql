-- Add provider-aware asset catalog fields and link MAIN wallet assets to Asset.

-- 1) Enum for providers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PriceProvider') THEN
    CREATE TYPE "PriceProvider" AS ENUM ('COINGECKO', 'TWELVEDATA', 'MANUAL');
  END IF;
END$$;

-- 2) Asset changes
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "provider" "PriceProvider" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "exchange" TEXT;

-- apiId becomes optional
ALTER TABLE "Asset" ALTER COLUMN "apiId" DROP NOT NULL;

-- drop old uniques if they exist
ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_symbol_type_key";
ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_apiId_type_key";

-- new unique: provider + apiId + type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Asset_provider_apiId_type_key'
  ) THEN
    CREATE UNIQUE INDEX "Asset_provider_apiId_type_key" ON "Asset"("provider", "apiId", "type");
  END IF;
END$$;

-- helpful search indexes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='Asset_type_symbol_idx') THEN
    CREATE INDEX "Asset_type_symbol_idx" ON "Asset"("type", "symbol");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='Asset_type_name_idx') THEN
    CREATE INDEX "Asset_type_name_idx" ON "Asset"("type", "name");
  END IF;
END$$;

-- 3) WalletAsset changes
ALTER TABLE "WalletAsset" ADD COLUMN IF NOT EXISTS "assetId" TEXT;

-- FK (restrict delete so catalog can't be removed if referenced)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_type='FOREIGN KEY'
      AND table_name='WalletAsset'
      AND constraint_name='WalletAsset_assetId_fkey'
  ) THEN
    ALTER TABLE "WalletAsset"
      ADD CONSTRAINT "WalletAsset_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "Asset"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

-- Unique to ensure merge behavior (MAIN per wallet+asset)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='WalletAsset_walletId_assetId_kind_key'
  ) THEN
    CREATE UNIQUE INDEX "WalletAsset_walletId_assetId_kind_key" ON "WalletAsset"("walletId", "assetId", "kind");
  END IF;
END$$;
