-- Create a function to sync changes from merchants table to Store table
CREATE OR REPLACE FUNCTION sync_merchants_to_store()
RETURNS TRIGGER AS $$
DECLARE
    v_city_id TEXT;
BEGIN
    -- Only sync if relevant fields have changed
    IF (OLD.store_name IS DISTINCT FROM NEW.store_name OR 
        OLD.address IS DISTINCT FROM NEW.address OR 
        OLD.city IS DISTINCT FROM NEW.city) THEN
        
        -- 1. Try to find the city ID for the city name provided in merchants
        SELECT id INTO v_city_id FROM "City" WHERE name = NEW.city LIMIT 1;
        
        -- 2. Update the Store record
        UPDATE "Store"
        SET 
            name = NEW.store_name,
            address = NEW.address,
            "cityId" = COALESCE(v_city_id, "cityId"), -- Don't overwrite with null if city not found
            "updatedAt" = NOW()
        WHERE id = NEW.id::TEXT;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_merchants_to_store ON merchants;
CREATE TRIGGER trg_sync_merchants_to_store
AFTER UPDATE ON merchants
FOR EACH ROW
EXECUTE FUNCTION sync_merchants_to_store();
