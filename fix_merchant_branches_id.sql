
-- Fix missing default value for ID column
ALTER TABLE "merchant_branches" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
