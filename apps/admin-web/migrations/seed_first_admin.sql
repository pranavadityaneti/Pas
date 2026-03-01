-- =============================================================================
-- SEED FIRST SUPER ADMIN
-- =============================================================================
-- Run this script in Supabase SQL Editor to create the first admin account.
-- This is required before anyone can log into the Super Admin Dashboard.
--
-- IMPORTANT: After running this, you can log in with:
--   Email: admin@pickatstore.com
--   Password: (the password you set in Supabase Auth)
-- =============================================================================

-- Step 1: Create the user in Supabase Auth (via Dashboard or API)
-- Go to: Supabase Dashboard > Authentication > Users > Add User
-- Create user with:
--   Email: admin@pickatstore.com
--   Password: Your secure password
--   Auto-confirm: Yes
--
-- Note the user ID from the created user (UUID format)

-- Step 2: Run this SQL with the user ID from Step 1
-- Replace 'USER_ID_FROM_AUTH' with the actual UUID

DO $$
DECLARE
    admin_user_id UUID := 'USER_ID_FROM_AUTH'; -- REPLACE THIS
    admin_email TEXT := 'admin@pickatstore.com';
    admin_name TEXT := 'Super Admin';
BEGIN
    -- Check if user already exists
    IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = admin_email) THEN
        INSERT INTO "User" (
            id,
            email,
            "passwordHash",
            role,
            name,
            "createdAt",
            "updatedAt"
        ) VALUES (
            admin_user_id,
            admin_email,
            'managed-by-supabase-auth',
            'SUPER_ADMIN',
            admin_name,
            NOW(),
            NOW()
        );
        RAISE NOTICE 'Super Admin created successfully!';
    ELSE
        RAISE NOTICE 'Admin user already exists, skipping.';
    END IF;
END $$;

-- =============================================================================
-- ALTERNATIVE: Quick one-liner (if you know the user ID)
-- =============================================================================
-- INSERT INTO "User" (id, email, "passwordHash", role, name, "createdAt", "updatedAt")
-- VALUES (
--     'YOUR-UUID-HERE',
--     'admin@pickatstore.com',
--     'managed-by-supabase-auth',
--     'SUPER_ADMIN',
--     'Super Admin',
--     NOW(),
--     NOW()
-- );
