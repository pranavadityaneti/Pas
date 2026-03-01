-- Add activities column to StoreStaff table
ALTER TABLE "StoreStaff" 
ADD COLUMN IF NOT EXISTS "activities" text[] DEFAULT '{}';

COMMENT ON COLUMN "StoreStaff"."activities" IS 'List of allowed activities/permissions for the staff member';
