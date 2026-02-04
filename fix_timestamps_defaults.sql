-- Fix Product Table Timestamps
ALTER TABLE "Product" 
ALTER COLUMN "updatedAt" SET DEFAULT now();

-- Fix StoreProduct Table Timestamps
ALTER TABLE "StoreProduct" 
ALTER COLUMN "updatedAt" SET DEFAULT now();
