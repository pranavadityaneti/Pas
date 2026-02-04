
-- 1. Update sync_merchants_to_store to handle INSERT and include better logic
CREATE OR REPLACE FUNCTION public.sync_merchants_to_store()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_city_id TEXT;
BEGIN
    -- Handle INSERT (New Merchant Signup)
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
            
    -- Handle UPDATE (Profile Changes)
    ELSIF (TG_OP = 'UPDATE') THEN
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

-- Ensure trigger runs on INSERT too
DROP TRIGGER IF EXISTS trg_sync_merchants_to_store ON merchants;
CREATE TRIGGER trg_sync_merchants_to_store
AFTER INSERT OR UPDATE ON merchants
FOR EACH ROW EXECUTE FUNCTION sync_merchants_to_store();


-- 2. Create sync_merchants_to_user to manage Role and Name
CREATE OR REPLACE FUNCTION public.sync_merchants_to_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Sync data to User table
    -- Since auth.users is handled by Supabase, we focus on the public.User table
    INSERT INTO "User" (id, name, email, phone, role, "updatedAt")
    VALUES (
        NEW.id,
        NEW.owner_name,
        NEW.email,
        NEW.phone,
        'MERCHANT',
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        role = 'MERCHANT',
        "updatedAt" = NOW();
        
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_merchants_to_user ON merchants;
CREATE TRIGGER trg_sync_merchants_to_user
AFTER INSERT OR UPDATE ON merchants
FOR EACH ROW EXECUTE FUNCTION sync_merchants_to_user();
