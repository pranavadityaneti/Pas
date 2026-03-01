-- Trigger: Auto-link Store to Merchant on insert
-- When a Store is created, find the matching merchant by email and set merchant_id

CREATE OR REPLACE FUNCTION auto_link_store_to_merchant()
RETURNS TRIGGER AS $$
BEGIN
    -- Find merchant by matching email through User table
    NEW.merchant_id := (
        SELECT m.id 
        FROM merchants m 
        WHERE m.email = (
            SELECT u.email 
            FROM "User" u 
            WHERE u.id = NEW."managerId"
        )
        LIMIT 1
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on Store insert
DROP TRIGGER IF EXISTS trg_auto_link_store_merchant ON "Store";
CREATE TRIGGER trg_auto_link_store_merchant
    BEFORE INSERT ON "Store"
    FOR EACH ROW
    EXECUTE FUNCTION auto_link_store_to_merchant();

-- Also create trigger on Store update (in case managerId changes)
DROP TRIGGER IF EXISTS trg_auto_link_store_merchant_update ON "Store";
CREATE TRIGGER trg_auto_link_store_merchant_update
    BEFORE UPDATE OF "managerId" ON "Store"
    FOR EACH ROW
    WHEN (OLD."managerId" IS DISTINCT FROM NEW."managerId")
    EXECUTE FUNCTION auto_link_store_to_merchant();
