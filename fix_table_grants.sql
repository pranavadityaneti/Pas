-- Grant table permissions to application roles
-- This is necessary because tables created via SQL Editor might not have these grants by default

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StoreStaff" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StoreStaff" TO service_role;

-- Also ensure the sequence (if any, though we use UUIDs) is accessible, just in case
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Verify RLS is enabled (should be, but good to be safe)
ALTER TABLE "StoreStaff" ENABLE ROW LEVEL SECURITY;
