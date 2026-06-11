-- Phase 7G (2026-06-11) — settlement hardening from the adversarial audit.
-- Four fixes, all additive or data-only:

-- 1. AUDIT BLOCKER: seeded commission rules defaulted effective_from to the
--    migration apply time (~2026-06-10), so resolveRule (effectiveFrom <= order
--    createdAt) could never match any order created during the epoch window
--    2026-06-01..06-10 — those orders would be held forever. Backdate every
--    rule to the IST-aligned Phase-7 epoch (Mon 1 Jun 00:00 IST). Safe guard:
--    only the 37 seed rows exist at this point; admin-created rules come later.
UPDATE "public"."commission_rules"
   SET "effective_from" = '2026-05-31T18:30:00Z'
 WHERE "effective_from" > '2026-05-31T18:30:00Z';

-- 2. AUDIT HIGH: COUPON_REIMBURSEMENT lines had no uniqueness guard, so
--    concurrent closes could reimburse the same coupon twice. Mirror the SALE
--    invariant: each order is coupon-reimbursed at most once, DB-enforced.
CREATE UNIQUE INDEX "settlement_line_coupon_order_unique_idx"
    ON "public"."settlement_lines" ("order_id")
    WHERE "kind" = 'COUPON_REIMBURSEMENT';

-- 3. AUDIT LOW (ledger immutability): cycle deletion must never cascade-erase
--    settlement lines — that would silently re-open double-settlement for
--    every order in the deleted cycle. RESTRICT instead.
ALTER TABLE "public"."settlement_lines" DROP CONSTRAINT "settlement_lines_cycle_id_fkey";
ALTER TABLE "public"."settlement_lines"
    ADD CONSTRAINT "settlement_lines_cycle_id_fkey" FOREIGN KEY ("cycle_id")
        REFERENCES "public"."settlement_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. AUDIT LOW: frozen commission totals were recovered by regex-parsing the
--    human-readable note under concurrency. Store the per-line commission
--    facts as real columns so recompute is always exact.
ALTER TABLE "public"."settlement_lines" ADD COLUMN "commission_base" DECIMAL(12,2);
ALTER TABLE "public"."settlement_lines" ADD COLUMN "commission_amount" DECIMAL(12,2);
