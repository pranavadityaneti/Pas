-- Add Settings columns to Store
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "operating_hours" JSONB DEFAULT '{}';
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "payout_config" JSONB DEFAULT '{}';

-- Create Store Staff table
CREATE TABLE IF NOT EXISTS "store_staff" (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "store_id" TEXT REFERENCES "Store"("id") ON DELETE CASCADE,
    "full_name" TEXT NOT NULL,
    "role" TEXT DEFAULT 'Staff',
    "phone" TEXT,
    "is_owner" BOOLEAN DEFAULT FALSE,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "store_staff" ENABLE ROW LEVEL SECURITY;

-- Allow Store Managers to manage their staff
-- Note: This assumes the auth.uid() is the managerId of the store
CREATE POLICY "Managers can manage their staff" ON "store_staff"
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM "Store"
            WHERE "Store"."id" = "store_staff"."store_id"
            AND "Store"."managerId" = auth.uid()::text
        )
    );
