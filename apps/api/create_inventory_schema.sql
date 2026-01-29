-- 1. Create Store Inventory Table (Linking Stores to Master Products)
CREATE TABLE IF NOT EXISTS store_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL, -- Merchant's override price
    is_available BOOLEAN DEFAULT true,
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(store_id, product_id) -- Prevent duplicate listings
);

-- 2. RLS Policies
ALTER TABLE store_inventory ENABLE ROW LEVEL SECURITY;

-- Policy: Merchants can view their own inventory
CREATE POLICY "Merchants can view own inventory" 
ON store_inventory FOR SELECT 
USING (auth.uid() = store_id);

-- Policy: Merchants can insert (add products)
CREATE POLICY "Merchants can add inventory" 
ON store_inventory FOR INSERT 
WITH CHECK (auth.uid() = store_id);

-- Policy: Merchants can update their own inventory (price/stock)
CREATE POLICY "Merchants can update own inventory" 
ON store_inventory FOR UPDATE 
USING (auth.uid() = store_id);

-- Policy: Merchants can delete (remove product from store)
CREATE POLICY "Merchants can delete own inventory" 
ON store_inventory FOR DELETE 
USING (auth.uid() = store_id);

-- 3. RPC to Search Master Catalog (Excluding already added items)
-- This helps the merchant add new items without seeing duplicates
CREATE OR REPLACE FUNCTION search_master_catalog_for_store(
    p_store_id UUID, 
    p_query TEXT
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    category TEXT,
    mrp DECIMAL,
    image TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.name, p.category, p.mrp, p.image
    FROM products p
    WHERE (p.name ILIKE '%' || p_query || '%' OR p.category ILIKE '%' || p_query || '%')
    AND p.id NOT IN (
        SELECT si.product_id FROM store_inventory si WHERE si.store_id = p_store_id
    )
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
