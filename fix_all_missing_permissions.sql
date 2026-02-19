
-- Comprehensive Permission Fix for Mobile App Tables
-- Grants SELECT, INSERT, UPDATE, DELETE to authenticated users where appropriate

-- 1. Grant usage on public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant all on all tables to postgres and service_role (Admin/Backend)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;

-- 3. Grant specific permissions to 'authenticated' (Mobile App Users)

-- Read-Only Tables (Catalog, Config)
GRANT SELECT ON TABLE "City", "ServiceArea", "Product", "ProductImage", "ProductAuditLog" TO authenticated;

-- Read-Write Tables (User Data, Stores, Orders)
GRANT SELECT, INSERT, UPDATE ON TABLE "User" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE "Store" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StoreProduct" TO authenticated; -- Manage Inventory
GRANT SELECT, INSERT, UPDATE ON TABLE "Order" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE "OrderItem" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE "notifications" TO authenticated; -- Corrected table name
GRANT SELECT, INSERT, UPDATE ON TABLE "subscriptions" TO authenticated; -- Corrected table name
GRANT SELECT, INSERT, UPDATE ON TABLE "merchants" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "merchant_branches" TO authenticated;

-- 4. Enable RLS on all tables (Safety Net)
ALTER TABLE "City" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceArea" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY; -- Corrected
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY; -- Corrected
ALTER TABLE "merchants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "merchant_branches" ENABLE ROW LEVEL SECURITY;

-- 5. Create basic "Public Read" policies for Catalog tables if they don't exist
-- (Dropping first to avoid errors)

DROP POLICY IF EXISTS "Public Read City" ON "City";
CREATE POLICY "Public Read City" ON "City" FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Public Read ServiceArea" ON "ServiceArea";
CREATE POLICY "Public Read ServiceArea" ON "ServiceArea" FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Public Read Product" ON "Product";
CREATE POLICY "Public Read Product" ON "Product" FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Public Read ProductImage" ON "ProductImage";
CREATE POLICY "Public Read ProductImage" ON "ProductImage" FOR SELECT TO authenticated, anon USING (true);

-- 6. Grant sequence usage (Critical for new inserts)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
