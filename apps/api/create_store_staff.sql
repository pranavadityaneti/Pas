-- ==========================================
-- CREATE STORE STAFF TABLE
-- ==========================================
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS "public"."store_staff" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "auth_user_id" UUID UNIQUE,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT NOT NULL UNIQUE,
    "activities" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_staff_pkey" PRIMARY KEY ("id")
);

-- Add Foreign Key to Store
ALTER TABLE "public"."store_staff" 
ADD CONSTRAINT "store_staff_store_id_fkey" 
FOREIGN KEY ("store_id") REFERENCES "public"."Store"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE "public"."store_staff";

-- Note: RLS policies should be added manually as per requirements.
