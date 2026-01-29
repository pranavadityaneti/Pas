-- Function: get_merchant_stats
-- Calculates full analytics including Top Categories and Daily Trends.

CREATE OR REPLACE FUNCTION get_merchant_stats(merchant_id UUID)
RETURNS JSON AS $$
DECLARE
    -- Scalars
    total_orders INTEGER;
    orders_30d INTEGER;
    total_gmv FLOAT;
    gmv_30d FLOAT;
    avg_order_val FLOAT;
    
    -- JSON Arrays
    daily_orders_json JSON;
    top_categories_json JSON;
BEGIN
    -------------------------------------------------------------------------
    -- 1. SCALAR METRICS (Using the reliable 'orders' table for high-level stats)
    -------------------------------------------------------------------------
    
    -- Calculate Total Orders
    SELECT COUNT(*) INTO total_orders FROM "Order" WHERE "storeId" = merchant_id::text;

    -- Calculate Orders Last 30 Days
    SELECT COUNT(*) INTO orders_30d FROM "Order" 
    WHERE "storeId" = merchant_id::text AND "createdAt" > NOW() - INTERVAL '30 days';

    -- Calculate Total GMV
    SELECT COALESCE(SUM("totalAmount"), 0) INTO total_gmv FROM "Order" WHERE "storeId" = merchant_id::text;

    -- Calculate GMV 30 Days
    SELECT COALESCE(SUM("totalAmount"), 0) INTO gmv_30d FROM "Order" 
    WHERE "storeId" = merchant_id::text AND "createdAt" > NOW() - INTERVAL '30 days';

    -- Calculate Average Order Value
    IF total_orders > 0 THEN
        avg_order_val := total_gmv / total_orders;
    ELSE
        avg_order_val := 0;
    END IF;

    -------------------------------------------------------------------------
    -- 2. DAILY TRENDS (Last 30 Days)
    -------------------------------------------------------------------------
    SELECT json_agg(t) INTO daily_orders_json
    FROM (
        SELECT 
            TO_CHAR("createdAt", 'YYYY-MM-DD') as date,
            COUNT(*) as orders,
            COALESCE(SUM("totalAmount"), 0) as gmv
        FROM "Order"
        WHERE "storeId" = merchant_id::text 
          AND "createdAt" > NOW() - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY 1 ASC
    ) t;

    -------------------------------------------------------------------------
    -- 3. TOP CATEGORIES (Joining Prisma tables for rich data)
    -------------------------------------------------------------------------
    -- Flow: Order -> OrderItem -> StoreProduct -> Product -> Category
    SELECT json_agg(t) INTO top_categories_json
    FROM (
        SELECT 
            p.category as name,
            COUNT(*) as count
        FROM "OrderItem" oi
        JOIN "StoreProduct" sp ON oi."storeProductId" = sp.id
        JOIN "Product" p ON sp."productId" = p.id
        JOIN "Order" o ON oi."orderId" = o.id
        WHERE o."storeId" = merchant_id::text
        GROUP BY p.category
        ORDER BY count DESC
        LIMIT 5
    ) t;

    -------------------------------------------------------------------------
    -- 4. FINAL RETURN
    -------------------------------------------------------------------------
    RETURN json_build_object(
        'total_orders', total_orders,
        'orders_30d', orders_30d,
        'total_gmv', total_gmv,
        'gmv_30d', gmv_30d,
        'avg_order_value', avg_order_val,
        'daily_orders', COALESCE(daily_orders_json, '[]'::json),
        'top_categories', COALESCE(top_categories_json, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql;
