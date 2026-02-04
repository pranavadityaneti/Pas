-- Add createdByStoreId column to Product table
ALTER TABLE "Product" 
ADD COLUMN IF NOT EXISTS "createdByStoreId" text;

-- Create an index for faster filtering
CREATE INDEX IF NOT EXISTS "Product_createdByStoreId_idx" ON "Product" ("createdByStoreId");

-- Policies (Optional but good for RLS)
-- We want everyone to see Global products (createdByStoreId IS NULL)
-- We want Stores to see their OWN products (createdByStoreId = storeId)

-- Note: We assume existing RLS or application logic handles visibility, 
-- but this column is now available for filtering.
