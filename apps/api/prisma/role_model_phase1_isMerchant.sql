-- =============================================================================
-- Role-model Phase 1 (2026-06-28): add the `isMerchant` capability flag.
-- Run in the Supabase SQL editor (or `prisma db execute`). Idempotent.
--
-- WHY: `User.role` is a single scalar that the merchant paths overwrite to
-- 'MERCHANT', erasing the fact that a store owner is also a customer (this hid 7
-- order-placing users from every role='CONSUMER' query). Phase 1 introduces an
-- additive boolean `isMerchant` (mirrors `isAdmin`) and DUAL-WRITES it alongside
-- the existing role='MERCHANT'. role is intentionally KEPT in Phase 1 so no reader
-- changes behaviour yet; the role overwrite is removed in Phase 3 after Phase 2
-- migrates the readers to isMerchant.
--
-- ORDER: run this BEFORE deploying the matching API build (the new code writes
-- `isMerchant`; the column must exist first).
-- =============================================================================

-- 1. Column (NOT NULL default false), mirroring User.isAdmin.
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "isMerchant" boolean NOT NULL DEFAULT false;

-- 2. Backfill: any id that owns a merchants row is a merchant.
UPDATE "public"."User" u
SET "isMerchant" = true
WHERE EXISTS (SELECT 1 FROM "public"."merchants" m WHERE m.id = u.id)
  AND u."isMerchant" = false;

-- 3. Trigger: sync_merchant_data_robust() now ALSO sets "isMerchant" = true on the
--    User row (dual-write). role='MERCHANT' is KEPT here for Phase 1 — removed in
--    Phase 3. Everything else is identical to fix_signup_sync_trigger_storename.sql.
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

    INSERT INTO "User" (id, name, email, phone, role, "isMerchant", "passwordHash", "updatedAt", "createdAt")
    VALUES (
        NEW.id::uuid,
        NEW.owner_name,
        v_email_to_use,
        NEW.phone,
        'MERCHANT',
        TRUE,              -- role-model Phase 1: dual-write the capability flag
        NULL,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = v_email_to_use,
        phone = EXCLUDED.phone,
        role = 'MERCHANT',
        "isMerchant" = TRUE,   -- role-model Phase 1: dual-write the capability flag
        "updatedAt" = NOW();

    SELECT id INTO v_city_id FROM "City" WHERE name = NEW.city LIMIT 1;

    INSERT INTO "Store" (
        id, name, address, "cityId", "managerId", active,
        image, "operating_hours", "operating_days",
        "createdAt", "updatedAt"
    )
    VALUES (
        NEW.id::uuid,
        COALESCE(NEW.store_name, 'My Store'),
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
        name = COALESCE(NEW.store_name, "Store".name),
        address = EXCLUDED.address,
        "cityId" = EXCLUDED."cityId",
        image = EXCLUDED.image,
        "operating_hours" = EXCLUDED."operating_hours",
        "operating_days" = EXCLUDED."operating_days",
        "updatedAt" = NOW();

    RETURN NEW;
END;
$function$;

-- 4. Verify (optional):
--   SELECT count(*) FILTER (WHERE "isMerchant") AS merchants,
--          count(*) FILTER (WHERE NOT "isMerchant") AS non_merchants FROM "User";
--   -- expect merchants == number of rows owning a merchants row (8 at time of writing).
