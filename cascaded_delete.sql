
-- Final robust function to delete merchants and ALL associated data including OrderItems
CREATE OR REPLACE FUNCTION delete_merchants_cascaded(merchant_ids UUID[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_ids_text TEXT[];
    v_store_ids TEXT[];
    v_count_order_items INT;
    v_count_orders INT;
    v_count_stores INT;
    v_count_merchants INT;
    v_count_users INT;
    v_count_auth INT;
BEGIN
    v_ids_text := merchant_ids::TEXT[];
    
    -- 0. Get all Store IDs associated with these merchants (managerIds)
    SELECT COALESCE(ARRAY_AGG(id::TEXT), ARRAY[]::TEXT[]) INTO v_store_ids 
    FROM "Store" 
    WHERE "managerId" = ANY(v_ids_text);

    -- 1. Deepest dependencies
    -- Order Items (Supabase)
    DELETE FROM order_items 
    WHERE order_id IN (SELECT id FROM orders WHERE store_id = ANY(merchant_ids) OR user_id = ANY(v_ids_text));
    GET DIAGNOSTICS v_count_order_items = ROW_COUNT;
    
    -- Order Items (Prisma)
    DELETE FROM "OrderItem" 
    WHERE "orderId" IN (SELECT id FROM "Order" WHERE "storeId" = ANY(v_store_ids) OR "userId" = ANY(v_ids_text))
       OR "storeProductId" IN (SELECT id FROM "StoreProduct" WHERE "storeId" = ANY(v_store_ids));
    
    -- Product Images and Audit Logs
    DELETE FROM "ProductImage" WHERE "productId" IN (SELECT id FROM "Product" WHERE "createdByStoreId" = ANY(v_store_ids));
    DELETE FROM "ProductAuditLog" WHERE "productId" IN (SELECT id FROM "Product" WHERE "createdByStoreId" = ANY(v_store_ids));
    
    -- 2. Leaf dependencies
    -- Store Products (Inventory)
    DELETE FROM "StoreProduct" WHERE "storeId" = ANY(v_store_ids);
    
    -- Staff
    DELETE FROM "StoreStaff" WHERE "store_id" = ANY(v_store_ids);
    DELETE FROM store_staff WHERE store_id = ANY(v_store_ids);
    
    -- Branches
    DELETE FROM "StoreBranch" WHERE "masterStoreId" = ANY(v_store_ids);
    DELETE FROM merchant_branches WHERE merchant_id = ANY(merchant_ids);
    
    -- KYC
    DELETE FROM "MerchantKYC" WHERE "storeId" = ANY(v_store_ids);
    
    -- Orders (Supabase and Prisma)
    DELETE FROM "Order" WHERE "storeId" = ANY(v_store_ids) OR "userId" = ANY(v_ids_text);
    DELETE FROM orders WHERE store_id = ANY(merchant_ids) OR user_id = ANY(v_ids_text);
    GET DIAGNOSTICS v_count_orders = ROW_COUNT;

    -- 3. Intermediate Level (Store)
    DELETE FROM "Product" WHERE "createdByStoreId" = ANY(v_store_ids);
    
    DELETE FROM "Store" WHERE id = ANY(v_store_ids) OR "managerId" = ANY(v_ids_text);
    GET DIAGNOSTICS v_count_stores = ROW_COUNT;
    
    -- 4. Core Level (User)
    DELETE FROM "User" WHERE id = ANY(v_ids_text);
    GET DIAGNOSTICS v_count_users = ROW_COUNT;
    
    -- 5. Root Level (merchants)
    DELETE FROM merchants WHERE id = ANY(merchant_ids);
    GET DIAGNOSTICS v_count_merchants = ROW_COUNT;
    
    -- 6. Supabase Auth Level
    DELETE FROM auth.users WHERE id = ANY(merchant_ids);
    GET DIAGNOSTICS v_count_auth = ROW_COUNT;

    RETURN jsonb_build_object(
        'order_items', v_count_order_items,
        'orders', v_count_orders,
        'stores', v_count_stores,
        'users', v_count_users,
        'merchants', v_count_merchants,
        'auth_users', v_count_auth
    );
END;
$$;
