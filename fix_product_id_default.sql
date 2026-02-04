-- Enable pgcrypto extension if not exists (needed for gen_random_uuid in older postgres, though gen_random_uuid is often built-in in v13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Fix Product Table ID
ALTER TABLE "Product" 
ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Fix StoreProduct Table ID (Just in case)
ALTER TABLE "StoreProduct" 
ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
