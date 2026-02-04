-- Create StoreStaff table
CREATE TABLE IF NOT EXISTS "StoreStaff" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id text NOT NULL REFERENCES "Store"(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL,
  phone text NOT NULL,
  branch text,
  initials text GENERATED ALWAYS AS (substring(name from 1 for 1)) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE "StoreStaff" ENABLE ROW LEVEL SECURITY;

-- Policy: Store Managers can view their own staff
-- We link auth.uid() -> User.id -> Store.managerId -> Store.id -> StoreStaff.store_id
-- Ideally, we check if the current user is the manager of the store_id in the row.

-- 1. VIEW Policy
CREATE POLICY "Managers can view their staff"
ON "StoreStaff"
FOR SELECT
USING (
  store_id IN (
    SELECT id FROM "Store" WHERE "managerId" = auth.uid()::text
  )
);

-- 2. INSERT Policy
CREATE POLICY "Managers can add staff"
ON "StoreStaff"
FOR INSERT
WITH CHECK (
  store_id IN (
    SELECT id FROM "Store" WHERE "managerId" = auth.uid()::text
  )
);

-- 3. UPDATE Policy
CREATE POLICY "Managers can update their staff"
ON "StoreStaff"
FOR UPDATE
USING (
  store_id IN (
    SELECT id FROM "Store" WHERE "managerId" = auth.uid()::text
  )
)
WITH CHECK (
  store_id IN (
    SELECT id FROM "Store" WHERE "managerId" = auth.uid()::text
  )
);

-- 4. DELETE Policy
CREATE POLICY "Managers can delete their staff"
ON "StoreStaff"
FOR DELETE
USING (
  store_id IN (
    SELECT id FROM "Store" WHERE "managerId" = auth.uid()::text
  )
);
