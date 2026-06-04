-- Phase 2.A2 — add `designation` column to merchants table.
--
-- Pairs with frontend Phase 2.A (StepIdentity captures owner's role/title:
-- Proprietor / Director / Partner). Populates the signatory block on the
-- partner-agreement PDF generated at Step 4 (Agreements + Digio eSign).
--
-- Spec reference: docs/merchant-signup-v2-spec.md — Step 1, blocker B2.
--
-- ──────────────────────────────────────────────────────────────────────
-- Run via Supabase Dashboard → SQL Editor. Safe to re-run (IF NOT EXISTS).
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS designation text;

-- Optional verification:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'merchants' AND column_name = 'designation';

-- ──────────────────────────────────────────────────────────────────────
-- After this migration runs successfully, the Phase 2.A2 backend tasks are:
--
-- 1. Add to Prisma schema (apps/api/prisma/schema.prisma) under model Merchant:
--      designation  String?  @map("designation")
--
-- 2. Run `npx prisma generate` in apps/api/.
--
-- 3. Add to PATCH /auth/merchant/draft handler in apps/api/src/index.ts
--    (look for the "if (payload.ownerName !== undefined)" block around line
--    4204) — add the parallel line:
--      if (payload.designation !== undefined) updateData.designation = payload.designation;
--
-- 4. Build + deploy:
--      cd apps/api && npm run build && eb deploy
-- ──────────────────────────────────────────────────────────────────────
