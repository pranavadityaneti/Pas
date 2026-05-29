-- Fix 42501 RLS errors: StoreProduct, Product, and Store tables have RLS enabled
-- but only SELECT policies. Merchants need INSERT/UPDATE/DELETE for catalog management.
-- This adds full CRUD policies for authenticated users on all three tables.

-- ═══════════════════════════════════════════════════════════
-- StoreProduct — merchants need to add/edit/remove store items
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "Allow authenticated insert on StoreProduct"
    ON "StoreProduct" FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on StoreProduct"
    ON "StoreProduct" FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on StoreProduct"
    ON "StoreProduct" FOR DELETE
    TO authenticated
    USING (true);

-- ═══════════════════════════════════════════════════════════
-- Product — merchants need to create new products in the catalog
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "Allow authenticated insert on Product"
    ON "Product" FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on Product"
    ON "Product" FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on Product"
    ON "Product" FOR DELETE
    TO authenticated
    USING (true);

-- ═══════════════════════════════════════════════════════════
-- Store — merchants need to update store settings
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "Allow authenticated insert on Store"
    ON "Store" FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on Store"
    ON "Store" FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on Store"
    ON "Store" FOR DELETE
    TO authenticated
    USING (true);
