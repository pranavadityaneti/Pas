-- =============================================================================
-- Role-model Phase 3 (2026-06-28): stop overwriting role to 'MERCHANT', restore the
-- base CONSUMER role. Run in the Supabase SQL editor (or `prisma db execute`). Idempotent.
--
-- PREREQUISITE / ORDERING: deploy the matching API build (stops the code-level role
-- overwrites) AND ship the merchant-app OTA (labels read isMerchant, not role) BEFORE
-- running step 2 — otherwise merchants briefly see a "User"/"Staff" label instead of
-- "Store Owner" in settings. isMerchant is already the source of truth (Phase 1/2).
-- =============================================================================

-- 1. Trigger: no longer stamps role='MERCHANT'. New merchant rows create the User as
--    role='CONSUMER' (base) with isMerchant=TRUE; existing users keep their role on
--    conflict (we only set isMerchant). Everything else identical to Phase 1.
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
        'CONSUMER',        -- role-model Phase 3: base role (was 'MERCHANT')
        TRUE,              -- isMerchant is the merchant signal
        NULL,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = v_email_to_use,
        phone = EXCLUDED.phone,
        -- role-model Phase 3: do NOT touch role on conflict (was role='MERCHANT') —
        -- preserves a consumer's (or admin's) existing role; isMerchant marks the owner.
        "isMerchant" = TRUE,
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

-- 2. Restore the base role for everyone the old flips left as MERCHANT. isMerchant
--    (set in Phase 1) already marks the real owners, so this only resets the label.
--    Admin/staff roles (SUPER_ADMIN/OPERATIONS/FINANCE/SUPPORT) are untouched.
UPDATE "public"."User" SET role = 'CONSUMER', "updatedAt" = NOW() WHERE role = 'MERCHANT';

-- 3. Verify (optional):
--   SELECT role, count(*) FROM "User" GROUP BY role ORDER BY 2 DESC;
--   -- expect 0 MERCHANT; isMerchant=true still = 8 (the real owners).
