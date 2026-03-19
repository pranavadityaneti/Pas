-- @lock — Do NOT overwrite. Approved migration as of Mar 16, 2026.
-- Database-level enforcement to prevent duplicate custom products
-- This script includes a robust cleanup step using a temporary table for multi-step merging.

-- 1. Create temporary map of duplicates
CREATE TEMP TABLE temp_duplicate_groups AS
SELECT id,
       FIRST_VALUE(id) OVER (
           PARTITION BY "createdByStoreId", (COALESCE("name", '')), (COALESCE("brand", '')), (COALESCE("uom", ''))
           ORDER BY "updatedAt" DESC
       ) as master_id
FROM "Product"
WHERE "createdByStoreId" IS NOT NULL;

-- 2. Re-point references to the 'Master' version
UPDATE "StoreProduct" SET "productId" = tdg.master_id 
FROM temp_duplicate_groups tdg 
WHERE "StoreProduct"."productId" = tdg.id 
  AND tdg.id != tdg.master_id;

UPDATE "ProductImage" SET "productId" = tdg.master_id 
FROM temp_duplicate_groups tdg 
WHERE "ProductImage"."productId" = tdg.id 
  AND tdg.id != tdg.master_id;

-- 3. Remove redundant product records
DELETE FROM "Product" 
WHERE id IN (SELECT id FROM temp_duplicate_groups WHERE id != master_id);

-- 4. Clean up temp table
DROP TABLE temp_duplicate_groups;

-- 5. Apply Unique Constraint
DROP INDEX IF EXISTS "idx_unique_store_product_variant";
CREATE UNIQUE INDEX "idx_unique_store_product_variant" 
ON "Product" (
    "createdByStoreId", 
    (COALESCE("name", '')), 
    (COALESCE("brand", '')), 
    (COALESCE("uom", ''))
)
WHERE "createdByStoreId" IS NOT NULL;

-- 6. Optimized index for suggestions
DROP INDEX IF EXISTS "idx_product_name_suggestion";
CREATE INDEX "idx_product_name_suggestion" ON "Product" ("name") WHERE "createdByStoreId" IS NULL;
