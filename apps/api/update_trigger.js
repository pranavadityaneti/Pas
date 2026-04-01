const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const updatedTrigger = `
CREATE OR REPLACE FUNCTION public.sync_merchant_data_robust()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_city_id TEXT;
    v_email_to_use TEXT;
    v_existing_email_id TEXT;
BEGIN
    v_email_to_use := NEW.email;
    
    IF v_email_to_use IS NOT NULL THEN
        SELECT id INTO v_existing_email_id FROM "User" WHERE email = v_email_to_use;
        IF v_existing_email_id IS NOT NULL AND v_existing_email_id != NEW.id THEN
            -- Suffix to avoid unique constraint crash
            v_email_to_use := NEW.id || '_' || v_email_to_use; 
        END IF;
    END IF;

    -- 1. Sync data to User table (UPSERT)
    INSERT INTO "User" (id, name, email, phone, role, "passwordHash", "updatedAt", "createdAt")
    VALUES (
        NEW.id,
        NEW.owner_name,
        v_email_to_use,
        NEW.phone,
        'MERCHANT',
        NULL, -- passwordHash is optional
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = v_email_to_use,
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
$function$
    `;

    await prisma.$executeRawUnsafe(updatedTrigger);
    console.log("Trigger updated successfully.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
