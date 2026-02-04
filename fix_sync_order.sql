
-- Unified function to handle both User and Store synchronization in the correct order
CREATE OR REPLACE FUNCTION public.sync_merchant_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_city_id TEXT;
BEGIN
    -- 1. Sync data to User table FIRST (Required for Store FK)
    INSERT INTO "User" (id, name, email, phone, role, "passwordHash", "updatedAt")
    VALUES (
        NEW.id,
        NEW.owner_name,
        NEW.email,
        NEW.phone,
        'MERCHANT',
        'SYNCED_FROM_MERCHANT', -- Placeholder to satisfy NOT NULL constraint
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        role = 'MERCHANT',
        "updatedAt" = NOW();

    -- 2. Sync data to Store table
    IF (TG_OP = 'INSERT') THEN
        -- Try to find the city ID for the city name provided
        SELECT id INTO v_city_id FROM "City" WHERE name = NEW.city LIMIT 1;
        
        -- Insert new store record
        INSERT INTO "Store" (id, name, address, "cityId", "managerId", active, "createdAt", "updatedAt")
        VALUES (
            NEW.id::TEXT, 
            NEW.store_name, 
            NEW.address, 
            COALESCE(v_city_id, (SELECT id FROM "City" LIMIT 1)), -- Fallback to first city if not found
            NEW.id, -- managerId matches merchant ID
            TRUE,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            address = EXCLUDED.address,
            "cityId" = EXCLUDED."cityId",
            "updatedAt" = NOW();
            
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Update existing store record if relevant fields changed
        IF (OLD.store_name IS DISTINCT FROM NEW.store_name OR 
            OLD.address IS DISTINCT FROM NEW.address OR 
            OLD.city IS DISTINCT FROM NEW.city) THEN
            
            SELECT id INTO v_city_id FROM "City" WHERE name = NEW.city LIMIT 1;
            
            UPDATE "Store"
            SET 
                name = NEW.store_name,
                address = NEW.address,
                "cityId" = COALESCE(v_city_id, "cityId"),
                "updatedAt" = NOW()
            WHERE id = NEW.id::TEXT;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Drop existing triggers
DROP TRIGGER IF EXISTS trg_sync_merchants_to_store ON merchants;
DROP TRIGGER IF EXISTS trg_sync_merchants_to_user ON merchants;

-- Create unified trigger
DROP TRIGGER IF EXISTS trg_sync_merchant_data ON merchants;
CREATE TRIGGER trg_sync_merchant_data
AFTER INSERT OR UPDATE ON merchants
FOR EACH ROW EXECUTE FUNCTION sync_merchant_data();
