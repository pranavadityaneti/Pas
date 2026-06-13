-- ════════════════════════════════════════════════════════════════════════════
-- Phase 9b — StoreProduct + Product + ProductImage WRITE lockdown  (STAGED — DO NOT APPLY YET)
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⛔ GATING CONDITION (hard): apply ONLY after the merchant-app OTA carrying the
--    Phase 9b rewires (services/catalog.ts + AddCustomProductModal +
--    AddMenuProductModal + ConfigureProductsModal + useInventory, commit
--    d9d2a2bb) has PROPAGATED, AND PR #3 has merged so admin-web
--    (StoreProductTable) is calling the new endpoint. Until then, old merchant
--    installs still write these tables directly via supabase-js; revoking now
--    breaks add/edit product + inventory stock/price management on those installs.
--
-- WHY SAFE ONCE GATED — every LIVE write path now goes through the API:
--   merchant-app  AddCustom/AddMenu modals → POST /merchant/products/save
--                 ConfigureProductsModal   → POST /merchant/store-products/configure
--                 useInventory             → PATCH/DELETE /merchant/store-products/:id
--   admin-web     StoreProductTable        → PATCH /merchant/store-products/:id
--   (verified: exhaustive grep shows ZERO direct StoreProduct/Product/ProductImage
--    writes in any live app. The API writes via supabaseAdmin (service_role),
--    which BYPASSES grants + RLS — unaffected.)
--
-- WHAT THIS CLOSES (RLS sweep):
--   StoreProduct : authenticated could write ANY row → a merchant could edit
--                  another merchant's catalog/prices/stock.
--   Product      : authenticated INSERT/UPDATE/DELETE on the global catalog.
--   ProductImage : ALL qual=true.
--
-- WHAT STAYS OPEN: SELECT — the consumer storefront + merchant inventory reads
--   need it. Removing the write GRANT blocks writes at the privilege layer
--   before any RLS policy is evaluated; reads are untouched.
--
-- HOW TO APPLY (when gated condition met):
--   1. mkdir prisma/migrations/<ts>_phase9b_catalog_lockdown
--   2. cp this file there as migration.sql (strip this STAGED header)
--   3. npx prisma migrate deploy
--   4. npx ts-node scripts/phase9b_catalog_lockdown_verify.ts   (all pass)
--   5. Smoke: add/edit a product (grocery + dining-menu), change stock/price,
--      configure products, admin edit — all still work (they hit the API now);
--      a raw supabase-js write to any of the three returns permission denied.
-- ════════════════════════════════════════════════════════════════════════════

REVOKE INSERT, UPDATE, DELETE ON public."StoreProduct"  FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public."Product"       FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public."ProductImage"  FROM anon, authenticated;

-- ROLLBACK (if needed):
--   GRANT INSERT, UPDATE, DELETE ON public."StoreProduct" TO authenticated;
--   GRANT INSERT, UPDATE, DELETE ON public."Product"      TO authenticated;
--   GRANT INSERT, UPDATE, DELETE ON public."ProductImage" TO authenticated;
