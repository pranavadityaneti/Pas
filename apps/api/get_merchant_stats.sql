-- Function: get_merchant_stats
-- Calculates real-time analytics for a specific merchant based on the orders table.

CREATE OR REPLACE FUNCTION get_merchant_stats(merchant_id UUID)
RETURNS JSON AS $$
DECLARE
    total_orders INTEGER;
    orders_30d INTEGER;
    total_gmv FLOAT;
    gmv_30d FLOAT;
    avg_order_val FLOAT;
BEGIN
    -- Calculate Total Orders
    SELECT COUNT(*) INTO total_orders FROM orders WHERE store_id = merchant_id;

    -- Calculate Orders Last 30 Days
    SELECT COUNT(*) INTO orders_30d FROM orders 
    WHERE store_id = merchant_id AND created_at > NOW() - INTERVAL '30 days';

    -- Calculate Total GMV
    SELECT COALESCE(SUM(amount), 0) INTO total_gmv FROM orders WHERE store_id = merchant_id;

    -- Calculate GMV 30 Days
    SELECT COALESCE(SUM(amount), 0) INTO gmv_30d FROM orders 
    WHERE store_id = merchant_id AND created_at > NOW() - INTERVAL '30 days';

    -- Calculate Average Order Value
    IF total_orders > 0 THEN
        avg_order_val := total_gmv / total_orders;
    ELSE
        avg_order_val := 0;
    END IF;

    -- Return JSON object
    RETURN json_build_object(
        'total_orders', total_orders,
        'orders_30d', orders_30d,
        'total_gmv', total_gmv,
        'gmv_30d', gmv_30d,
        'avg_order_value', avg_order_val
    );
END;
$$ LANGUAGE plpgsql;
