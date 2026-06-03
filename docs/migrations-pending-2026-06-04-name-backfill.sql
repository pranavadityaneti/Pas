-- =====================================================================
-- One-time backfill: profiles.full_name → "User".name
--
-- Apply via Supabase SQL Editor. SAFE TO RUN MULTIPLE TIMES — only
-- updates rows where User.name is NULL and profiles.full_name is set.
--
-- Why this exists:
--   The consumer app's ProfileSetupScreen has, until now, written the
--   user's name to public.profiles.full_name only (Supabase convention).
--   The admin Customers page reads public."User".name — which stays
--   NULL until something pushes it there.
--
--   Going forward (after Option A consumer-app OTA ships), the
--   ProfileSetupScreen will call POST /me/profile which writes BOTH
--   tables in one transaction. This SQL catches every existing user
--   so their names show up on /customers immediately.
--
--   Run cadence: once now is enough. Re-running is a no-op (the WHERE
--   clause filters to NULL User.name rows only).
-- =====================================================================

UPDATE public."User" u
SET    name = TRIM(p.full_name)
FROM   public.profiles p
WHERE  p.id = u.id
  AND  u.name IS NULL
  AND  p.full_name IS NOT NULL
  AND  LENGTH(TRIM(p.full_name)) >= 2;

-- Diagnostic — show how many rows landed (optional, run after)
-- SELECT COUNT(*) AS users_with_name FROM public."User" WHERE name IS NOT NULL;
-- SELECT COUNT(*) AS users_still_null FROM public."User" WHERE name IS NULL;
