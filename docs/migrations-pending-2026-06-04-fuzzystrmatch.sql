-- =====================================================================
-- Enable fuzzystrmatch extension — powers the customer duplicate detector
--
-- Apply via Supabase SQL Editor. Idempotent (IF NOT EXISTS).
--
-- What this unlocks:
--   /admin/customers calls Postgres `levenshtein(a.phone, b.phone)` to flag
--   customer pairs whose phone numbers differ by ≤1 character — catches
--   test-typo signups like 917842687373 ↔ 917842287373. Until this is
--   enabled, the API try/catches the function and silently returns no
--   hints (no breakage, just no duplicate-detection feature).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Verify
-- SELECT levenshtein('917842687373', '917842287373');  -- should return 1
