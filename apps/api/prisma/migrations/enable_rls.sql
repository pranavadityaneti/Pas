-- Protect master tables by enabling Row Level Security
ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreProduct" ENABLE ROW LEVEL SECURITY;

-- Establish Policies mapping to strictly harmless read-only actions for public clients
-- Any INSERT/UPDATE/DELETE attempt by a client without a secure service_role key will be hard-rejected.
CREATE POLICY "Allow public read access on Store" ON "Store" FOR SELECT USING (true);
CREATE POLICY "Allow public read access on Product" ON "Product" FOR SELECT USING (true);
CREATE POLICY "Allow public read access on StoreProduct" ON "StoreProduct" FOR SELECT USING (true);
