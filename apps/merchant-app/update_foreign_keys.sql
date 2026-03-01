-- This script drops the existing foreign key constraint and recreates it with ON DELETE CASCADE
-- This allows deleting a Product (which cascades to StoreProduct, and then to OrderItem) without constraint violations.

BEGIN;

-- 1. Identify and drop the existing constraint on OrderItem that points to StoreProduct
-- Note: Replace 'OrderItem_store_product_id_fkey' with the exact constraint name if different.
ALTER TABLE "OrderItem"
DROP CONSTRAINT IF EXISTS "OrderItem_store_product_id_fkey";

-- 2. Identify and drop the existing constraint on StoreProduct that points to Product (if needed to delete Products directly)
ALTER TABLE "StoreProduct"
DROP CONSTRAINT IF EXISTS "StoreProduct_productId_fkey";


-- 3. Re-add the StoreProduct -> Product constraint with CASCADE
ALTER TABLE "StoreProduct"
ADD CONSTRAINT "StoreProduct_productId_fkey"
FOREIGN KEY ("productId") 
REFERENCES "Product"("id") 
ON DELETE CASCADE;

-- 4. Re-add the OrderItem -> StoreProduct constraint with CASCADE
ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_store_product_id_fkey"
FOREIGN KEY ("store_product_id") 
REFERENCES "StoreProduct"("id") 
ON DELETE CASCADE;

COMMIT;
