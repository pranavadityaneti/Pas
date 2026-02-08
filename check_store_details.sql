-- Store Details Diagnostic Query
-- Run this in Supabase SQL Editor after completing merchant signup

-- 1. Check what's saved in merchants table
SELECT 
    id,
    email,
    store_name,
    address,
    city,
    category,
    store_photos,
    operating_days,
    created_at
FROM merchants
WHERE email = 'YOUR_TEST_MERCHANT_EMAIL@example.com';

-- 2. Check if Store record exists
SELECT 
    s.id,
    s.name,
    s.address,
    s.cityId,
    s.active,
    s.managerId,
    s.created_at
FROM "Store" s
JOIN merchants m ON s.managerId = m.id
WHERE m.email = 'YOUR_TEST_MERCHANT_EMAIL@example.com';

-- 3. Check City mapping (if cityId is missing)
SELECT id, name FROM "City" LIMIT 10;

-- Expected Results:
-- ✅ merchants table should have: store_name, address, category, store_photos array
-- ✅ Store table should exist with active=true
-- ❌ If Store doesn't exist, that's why details aren't appearing
-- ❌ If merchants.category or store_photos is null, signup flow is broken
