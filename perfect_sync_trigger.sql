
-- Robust Trigger to sync Merchant data to User and Store tables
-- Updated with correct column names for Store table (mixed case implementation)

CREATE OR REPLACE FUNCTION public.sync_merchant_data_robust()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_city_id TEXT;
BEGIN
    -- 1. Sync data to User table (UPSERT)
    INSERT INTO "User" (id, name, email, phone, role, "passwordHash", "updatedAt", "createdAt")
    VALUES (
        NEW.id,
        NEW.owner_name,
        NEW.email,
        NEW.phone,
        'MERCHANT',
        NULL, -- passwordHash is optional
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        role = 'MERCHANT',
        "updatedAt" = NOW();

    -- 2. Sync data to Store table (UPSERT)
    -- Resolve City ID
    SELECT id INTO v_city_id FROM "City" WHERE name = NEW.city LIMIT 1;
    
    INSERT INTO "Store" (
        id, name, address, "cityId", "managerId", active, 
        image, "operating_hours", "operating_days",
        "createdAt", "updatedAt"
    )
    VALUES (
        NEW.id::TEXT, 
        NEW.store_name, 
        NEW.address, 
        COALESCE(v_city_id, (SELECT id FROM "City" LIMIT 1)), -- Fallback
        NEW.id, -- managerId matches merchant ID
        TRUE,
        -- Sync Image: Use first photo from array if available
        CASE WHEN array_length(NEW.store_photos, 1) > 0 THEN NEW.store_photos[1] ELSE NULL END,
        NEW.operating_hours::json,
        NEW.operating_days,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        "cityId" = EXCLUDED."cityId",
        image = EXCLUDED.image,
        "operating_hours" = EXCLUDED."operating_hours",
        "operating_days" = EXCLUDED."operating_days",
        "updatedAt" = NOW();

    RETURN NEW;
END;
$$;

-- Drop all previous triggers
DROP TRIGGER IF EXISTS trg_sync_merchants_to_store ON merchants;
DROP TRIGGER IF EXISTS trg_sync_merchants_to_user ON merchants;
DROP TRIGGER IF EXISTS trg_sync_merchant_data ON merchants;
DROP TRIGGER IF EXISTS trg_sync_merchant_data_robust ON merchants;

-- Create the new trigger
CREATE TRIGGER trg_sync_merchant_data_robust
AFTER INSERT OR UPDATE ON merchants
FOR EACH ROW EXECUTE FUNCTION sync_merchant_data_robust();
