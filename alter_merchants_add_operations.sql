
-- Add missing operating details columns to merchants table
-- These are required for the sync trigger to work correctly

ALTER TABLE "merchants" 
ADD COLUMN IF NOT EXISTS "operating_hours" TEXT,
ADD COLUMN IF NOT EXISTS "operating_days" TEXT[];

-- Also ensure store_photos exists as it was used in the script
ALTER TABLE "merchants"
ADD COLUMN IF NOT EXISTS "store_photos" TEXT[];
