-- Migration: Add merchant_id foreign key to Store table
-- Purpose: Link stores to merchants for order aggregation

-- Add merchant_id column with foreign key reference
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL;

-- Create index for efficient joins
CREATE INDEX IF NOT EXISTS idx_store_merchant_id ON "Store"(merchant_id);

-- Backfill existing stores: find merchant by matching email through User table
UPDATE "Store" s 
SET merchant_id = (
  SELECT m.id 
  FROM merchants m 
  WHERE m.email = (
    SELECT u.email 
    FROM "User" u 
    WHERE u.id = s."managerId"
  )
  LIMIT 1
)
WHERE s.merchant_id IS NULL 
AND s."managerId" IS NOT NULL;

-- Verify backfill (run manually to check)
-- SELECT s.id, s.name, s.merchant_id, m.store_name 
-- FROM "Store" s 
-- LEFT JOIN merchants m ON s.merchant_id = m.id;
