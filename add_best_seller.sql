-- Migration: Add is_best_seller to StoreProduct

-- 1. Add the column if it doesn't exist
ALTER TABLE "public"."StoreProduct" 
ADD COLUMN IF NOT EXISTS "is_best_seller" boolean DEFAULT false;

-- 2. Comment (Optional)
COMMENT ON COLUMN "public"."StoreProduct"."is_best_seller" IS 'Flag to mark product as a best seller for this specific store';

-- 3. Update RLS policies if needed (assuming existing policies cover update)
-- typically StoreProduct policies allow update by store owner or admin.
