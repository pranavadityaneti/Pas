-- Phase 7 (2026-06-10) — Settlement & reconciliation ledger.
-- Design: docs/phase7-settlement-architecture.html (Q1-Q7 + FQ defaults
-- approved by Pranav 2026-06-10). Purely additive: 4 new tables + indexes +
-- commission seed rows. Touches NO existing tables.

-- ── commission_rules: admin-editable rate matrix ────────────────────────────
CREATE TABLE "public"."commission_rules" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "category"       TEXT NOT NULL,
    "order_type"     TEXT NOT NULL DEFAULT 'ANY',
    "tier"           INTEGER,
    "rate_pct"       DECIMAL(5,2) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provisional"    BOOLEAN NOT NULL DEFAULT false,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "commission_rules_category_order_type_idx"
    ON "public"."commission_rules" ("category", "order_type");

-- ── merchant_settlement_profiles: per-merchant settlement config ────────────
CREATE TABLE "public"."merchant_settlement_profiles" (
    "id"                  UUID NOT NULL,
    "commission_category" TEXT,
    "turnover_tier"       INTEGER,
    "settlement_hold"     BOOLEAN NOT NULL DEFAULT false,
    "notes"               TEXT,
    "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_settlement_profiles_pkey" PRIMARY KEY ("id")
);

-- ── settlement_cycles: one immutable row per (merchant, week) ───────────────
CREATE TABLE "public"."settlement_cycles" (
    "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
    "merchant_id"          UUID NOT NULL,
    "period_start"         TIMESTAMP(3) NOT NULL,
    "period_end"           TIMESTAMP(3) NOT NULL,
    "status"               TEXT NOT NULL DEFAULT 'OPEN',
    "gross_sales"          DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commission_base"      DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commission_amount"    DECIMAL(12,2) NOT NULL DEFAULT 0,
    "coupon_reimbursement" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "coupon_absorbed"      DECIMAL(12,2) NOT NULL DEFAULT 0,
    "clawback_amount"      DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gst_on_commission"    DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tcs_amount"           DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_payout"           DECIMAL(12,2) NOT NULL DEFAULT 0,
    "held_order_count"     INTEGER NOT NULL DEFAULT 0,
    "closed_at"            TIMESTAMP(3),
    "paid_at"              TIMESTAMP(3),
    "paid_by"              UUID,
    "payment_reference"    TEXT,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settlement_cycles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "settlement_cycle_merchant_period_key"
    ON "public"."settlement_cycles" ("merchant_id", "period_start");
CREATE INDEX "settlement_cycles_status_idx" ON "public"."settlement_cycles" ("status");

-- ── settlement_lines: the per-order receipts behind every cycle number ──────
CREATE TABLE "public"."settlement_lines" (
    "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
    "cycle_id"            UUID,
    "order_id"            UUID,
    "kind"                TEXT NOT NULL,
    "amount"              DECIMAL(12,2) NOT NULL,
    "commission_rate_pct" DECIMAL(5,2),
    "commission_rule_id"  UUID,
    "note"                TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settlement_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "settlement_lines_cycle_id_fkey" FOREIGN KEY ("cycle_id")
        REFERENCES "public"."settlement_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "settlement_lines_cycle_id_idx" ON "public"."settlement_lines" ("cycle_id");
CREATE INDEX "settlement_lines_order_id_idx" ON "public"."settlement_lines" ("order_id");
-- Each order settles exactly ONCE as a SALE (the ledger's core invariant).
CREATE UNIQUE INDEX "settlement_line_sale_order_unique_idx"
    ON "public"."settlement_lines" ("order_id")
    WHERE "kind" = 'SALE';

-- ── Seed commission_rules from Commissions.pdf (2026-06-10) ─────────────────
-- provisional = TRUE marks the two founder-unresolved items:
--   FQ-1: table (5%) vs bottom-summary (7%) conflict on Fashion/Beauty/Pet/
--         Sports/Home/Electronics/Gifting — table values seeded.
--   FQ-2: F&B tiers 3-5 blank — tier-2 rates (8/10) seeded as default.

-- Non-F&B categories (per-category, any order type)
INSERT INTO "public"."commission_rules" ("category","order_type","tier","rate_pct","provisional") VALUES
('Beauty & personal care',            'ANY', NULL, 5.00, true),
('Electricals, paints & automobiles', 'ANY', NULL, 5.00, false),
('Electronics and accessories',       'ANY', NULL, 5.00, true),
('Fashion and apparel',               'ANY', NULL, 5.00, true),
('Fresh items',                       'ANY', NULL, 2.00, false),
('Grocery and kirana',                'ANY', NULL, 2.00, false),
('Hardware and plumbing',             'ANY', NULL, 5.00, false),
('Home and lifestyle',                'ANY', NULL, 5.00, true),
('Pet care and supplies',             'ANY', NULL, 5.00, true),
('Pharmacy and wellness',             'ANY', NULL, 2.00, false),
('Puja and festive needs',            'ANY', NULL, 2.00, false),
('Sports and fitness',                'ANY', NULL, 5.00, true),
-- Sheet says "2% stationery, 5% others" within one category (+ gifting
-- conflict). Seeded at 2% provisional; admin can split into finer categories.
('Stationery, gifting, and toys',     'ANY', NULL, 2.00, true);

-- F&B: per order type (FQ-3 approved: order's type decides), per turnover tier.
-- Tier 1 (>1cr): 5/7. Tier 2 (60L-1cr): 8/10. Tiers 3-5 blank in sheet →
-- tier-2 default, provisional. Tier NULL = merchant not yet tiered → same
-- provisional default.
INSERT INTO "public"."commission_rules" ("category","order_type","tier","rate_pct","provisional") VALUES
('Restaurant and cafes', 'PICKUP', 1,    5.00,  false),
('Restaurant and cafes', 'DINING', 1,    7.00,  false),
('Restaurant and cafes', 'PICKUP', 2,    8.00,  false),
('Restaurant and cafes', 'DINING', 2,   10.00,  false),
('Restaurant and cafes', 'PICKUP', 3,    8.00,  true),
('Restaurant and cafes', 'DINING', 3,   10.00,  true),
('Restaurant and cafes', 'PICKUP', 4,    8.00,  true),
('Restaurant and cafes', 'DINING', 4,   10.00,  true),
('Restaurant and cafes', 'PICKUP', 5,    8.00,  true),
('Restaurant and cafes', 'DINING', 5,   10.00,  true),
('Restaurant and cafes', 'PICKUP', NULL, 8.00,  true),
('Restaurant and cafes', 'DINING', NULL,10.00,  true),
('Bakeries & Desserts',  'PICKUP', 1,    5.00,  false),
('Bakeries & Desserts',  'DINING', 1,    7.00,  false),
('Bakeries & Desserts',  'PICKUP', 2,    8.00,  false),
('Bakeries & Desserts',  'DINING', 2,   10.00,  false),
('Bakeries & Desserts',  'PICKUP', 3,    8.00,  true),
('Bakeries & Desserts',  'DINING', 3,   10.00,  true),
('Bakeries & Desserts',  'PICKUP', 4,    8.00,  true),
('Bakeries & Desserts',  'DINING', 4,   10.00,  true),
('Bakeries & Desserts',  'PICKUP', 5,    8.00,  true),
('Bakeries & Desserts',  'DINING', 5,   10.00,  true),
('Bakeries & Desserts',  'PICKUP', NULL, 8.00,  true),
('Bakeries & Desserts',  'DINING', NULL,10.00,  true);
