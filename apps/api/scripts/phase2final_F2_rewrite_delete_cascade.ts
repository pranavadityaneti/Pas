// Phase 2 FINAL — F2: rewrite delete_merchants_cascaded to remove the two
// StoreProduct.storeId references (B10-breaking) and key the StoreProduct +
// OrderItem deletes off merchant_branches.merchant_id — the SAME criterion the
// function already uses to delete branches, so the sets match exactly and any
// transitional NULL-store_id branch is still covered.
//
// Only 2 lines change vs the live definition (captured 2026-06-16). Reversible:
// re-apply the original def (saved in the audit trail / SESSION_LOG).
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const NEW_DEF = `
CREATE OR REPLACE FUNCTION public.delete_merchants_cascaded(merchant_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_ids_text TEXT[];
    v_store_ids TEXT[];
    v_count_order_items INT;
    v_count_orders INT;
    v_count_stores INT;
    v_count_merchants INT;
    v_count_users INT;
    v_count_auth INT;
BEGIN
    v_ids_text := merchant_ids::TEXT[];

    -- 0. Get all Store IDs associated with these merchants (managerIds)
    SELECT COALESCE(ARRAY_AGG(id::TEXT), ARRAY[]::TEXT[]) INTO v_store_ids
    FROM "Store"
    WHERE "managerId" = ANY(v_ids_text);

    -- 1. Deepest dependencies
    -- Order Items (Supabase)
    DELETE FROM order_items
    WHERE order_id IN (SELECT id FROM orders WHERE store_id = ANY(merchant_ids) OR user_id = ANY(v_ids_text));
    GET DIAGNOSTICS v_count_order_items = ROW_COUNT;

    -- Order Items (Prisma)
    -- Phase 2 FINAL F2 (2026-06-16): StoreProduct is keyed by branch now, not the
    -- dropped storeId column. Identify its OrderItems via the branch's merchant.
    DELETE FROM "OrderItem"
    WHERE "orderId" IN (SELECT id FROM "Order" WHERE "storeId" = ANY(v_store_ids) OR "userId" = ANY(v_ids_text))
       OR "storeProductId" IN (
            SELECT sp.id FROM "StoreProduct" sp
            JOIN merchant_branches mb ON mb.id = sp.branch_id
            WHERE mb.merchant_id = ANY(merchant_ids)
       );

    -- Product Images and Audit Logs
    DELETE FROM "ProductImage" WHERE "productId" IN (SELECT id FROM "Product" WHERE "createdByStoreId" = ANY(v_store_ids));
    DELETE FROM "ProductAuditLog" WHERE "productId" IN (SELECT id FROM "Product" WHERE "createdByStoreId" = ANY(v_store_ids));

    -- 2. Leaf dependencies
    -- Store Products (Inventory) — Phase 2 FINAL F2: delete via branch, not storeId.
    DELETE FROM "StoreProduct" sp
    USING merchant_branches mb
    WHERE sp.branch_id = mb.id AND mb.merchant_id = ANY(merchant_ids);

    -- Staff
    DELETE FROM "StoreStaff" WHERE "store_id" = ANY(v_store_ids);
    DELETE FROM store_staff WHERE store_id = ANY(v_store_ids);

    -- Branches
    DELETE FROM "StoreBranch" WHERE "masterStoreId" = ANY(v_store_ids);
    DELETE FROM merchant_branches WHERE merchant_id = ANY(merchant_ids);

    -- KYC
    DELETE FROM "MerchantKYC" WHERE "storeId" = ANY(v_store_ids);

    -- Orders (Supabase and Prisma)
    DELETE FROM "Order" WHERE "storeId" = ANY(v_store_ids) OR "userId" = ANY(v_ids_text);
    DELETE FROM orders WHERE store_id = ANY(merchant_ids) OR user_id = ANY(v_ids_text);
    GET DIAGNOSTICS v_count_orders = ROW_COUNT;

    -- 3. Intermediate Level (Store)
    DELETE FROM "Product" WHERE "createdByStoreId" = ANY(v_store_ids);

    DELETE FROM "Store" WHERE id = ANY(v_store_ids) OR "managerId" = ANY(v_ids_text);
    GET DIAGNOSTICS v_count_stores = ROW_COUNT;

    -- 4. Core Level (User)
    DELETE FROM "User" WHERE id = ANY(v_ids_text);
    GET DIAGNOSTICS v_count_users = ROW_COUNT;

    -- 5. Root Level (merchants)
    DELETE FROM merchants WHERE id = ANY(merchant_ids);
    GET DIAGNOSTICS v_count_merchants = ROW_COUNT;

    -- 6. Supabase Auth Level
    DELETE FROM auth.users WHERE id = ANY(merchant_ids);
    GET DIAGNOSTICS v_count_auth = ROW_COUNT;

    RETURN jsonb_build_object(
        'order_items', v_count_order_items,
        'orders', v_count_orders,
        'stores', v_count_stores,
        'users', v_count_users,
        'merchants', v_count_merchants,
        'auth_users', v_count_auth
    );
END;
$function$
`;

async function main() {
  // --- Correctness check FIRST (read-only): for every merchant, do the OLD
  //     (storeId-based) and NEW (branch.merchant_id-based) StoreProduct sets match?
  console.log('--- Correctness: old vs new StoreProduct identification per merchant ---');
  const cmp: any[] = await prisma.$queryRawUnsafe(`
    WITH merchants_all AS (SELECT id FROM merchants),
    old_set AS (
      SELECT m.id::text AS merchant_id, sp.id AS sp_id
      FROM merchants_all m
      JOIN "Store" s ON s."managerId"::text = m.id::text
      JOIN "StoreProduct" sp ON sp."storeId"::text = s.id::text
    ),
    new_set AS (
      SELECT m.id::text AS merchant_id, sp.id AS sp_id
      FROM merchants_all m
      JOIN merchant_branches mb ON mb.merchant_id::text = m.id::text
      JOIN "StoreProduct" sp ON sp.branch_id = mb.id
    )
    SELECT
      (SELECT COUNT(*) FROM old_set) AS old_count,
      (SELECT COUNT(*) FROM new_set) AS new_count,
      (SELECT COUNT(*) FROM (SELECT sp_id FROM old_set EXCEPT SELECT sp_id FROM new_set) d) AS in_old_not_new,
      (SELECT COUNT(*) FROM (SELECT sp_id FROM new_set EXCEPT SELECT sp_id FROM old_set) d) AS in_new_not_old;
  `);
  console.table(cmp);

  console.log('\n--- Applying CREATE OR REPLACE FUNCTION ---');
  await prisma.$executeRawUnsafe(NEW_DEF);
  console.log('  ✓ function replaced');

  console.log('\n--- Verify: new definition no longer references StoreProduct.storeId ---');
  const chk: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      (prosrc ILIKE '%StoreProduct%storeId%' OR prosrc ~ 'StoreProduct"[^;]*"storeId"') AS still_refs_sp_storeid,
      (prosrc ILIKE '%sp.branch_id = mb.id%') AS uses_branch_join
    FROM pg_proc WHERE proname='delete_merchants_cascaded';
  `);
  console.table(chk);
  // Precise check: does the body still contain the StoreProduct-storeId pattern?
  const body: any[] = await prisma.$queryRawUnsafe(`SELECT prosrc FROM pg_proc WHERE proname='delete_merchants_cascaded';`);
  const src: string = body[0].prosrc;
  const hasBadRef = /"StoreProduct"[\s\S]*?"storeId"/.test(src);
  console.log(hasBadRef ? '  ✗ STILL references StoreProduct.storeId' : '  ✓ no StoreProduct.storeId reference remains — B10-safe');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
