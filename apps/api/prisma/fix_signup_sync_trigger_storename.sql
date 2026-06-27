-- =============================================
-- Harden sync_merchant_data_robust() — Store.name null-safety (signup audit, 2026-06-26)
-- Run in the Supabase SQL Editor (or via `prisma db execute`). Idempotent (CREATE OR REPLACE).
-- =============================================
--
-- WHY: this AFTER INSERT OR UPDATE trigger on `merchants` upserts the merchant's
-- "Store" row from merchant-row columns. `Store.name` is NOT NULL, but the trigger
-- copied `NEW.store_name` verbatim:
--   * INSERT path  → a merchant inserted before its store name is set (the v2 flow
--     keys names on stores[].name, not the merchant row) inserts Store.name = NULL
--     → NOT NULL violation → the whole merchant INSERT fails (audit field #5).
--   * ON CONFLICT path → `name = EXCLUDED.name` (= NEW.store_name) would set
--     Store.name = NULL on a later merchant UPDATE, OR clobber the real name the
--     app already wrote.
--
-- FIX: COALESCE the INSERT to a safe placeholder, and on conflict KEEP the existing
-- Store.name when the merchant row carries no name (never null, never clobbered).
-- The app's own Store upsert overwrites the placeholder with the real name moments
-- later. Everything else in the function is unchanged.
--
-- NOTE (flagged, not fixed here): this trigger also re-copies address/city/image/
-- hours from the merchant row on every UPDATE, which can null out app-written Store
-- fields in the v2 stores[] model. That broader sync-vs-v2 mismatch is a separate,
-- carefully-scoped follow-up — out of scope for this null-safety fix.

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
        IF v_existing_email_id IS NOT NULL AND v_existing_email_id != NEW.id::text THEN
            v_email_to_use := NEW.id || '_' || v_email_to_use;
        END IF;
    END IF;

    INSERT INTO "User" (id, name, email, phone, role, "passwordHash", "updatedAt", "createdAt")
    VALUES (
        NEW.id::uuid,
        NEW.owner_name,
        v_email_to_use,
        NEW.phone,
        'MERCHANT',
        NULL,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = v_email_to_use,
        phone = EXCLUDED.phone,
        role = 'MERCHANT',
        "updatedAt" = NOW();

    SELECT id INTO v_city_id FROM "City" WHERE name = NEW.city LIMIT 1;

    INSERT INTO "Store" (
        id, name, address, "cityId", "managerId", active,
        image, "operating_hours", "operating_days",
        "createdAt", "updatedAt"
    )
    VALUES (
        NEW.id::uuid,
        COALESCE(NEW.store_name, 'My Store'),   -- #5 fix: never NULL on INSERT
        NEW.address,
        COALESCE(v_city_id, (SELECT id FROM "City" LIMIT 1)),
        NEW.id::uuid,
        TRUE,
        CASE WHEN array_length(NEW.store_photos, 1) > 0 THEN NEW.store_photos[1] ELSE NULL END,
        NEW.operating_hours::json,
        NEW.operating_days,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(NEW.store_name, "Store".name),  -- #5 fix: keep existing name when merchant row has none (never NULL, never clobber)
        address = EXCLUDED.address,
        "cityId" = EXCLUDED."cityId",
        image = EXCLUDED.image,
        "operating_hours" = EXCLUDED."operating_hours",
        "operating_days" = EXCLUDED."operating_days",
        "updatedAt" = NOW();

    RETURN NEW;
END;
$function$;
