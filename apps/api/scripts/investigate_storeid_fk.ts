// READ-ONLY investigation: StoreProduct.storeId vs Store.id vs MerchantBranch.id
// Phase 2 FINAL prep. No writes. Run from apps/api/.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 1. FK constraints on StoreProduct ===');
  const fks: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name  AS ref_table,
      ccu.column_name AS ref_column,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'StoreProduct';
  `);
  console.table(fks);

  console.log('\n=== 2. StoreProduct + Store + MerchantBranch raw counts ===');
  const [counts]: any = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*) FROM "StoreProduct")                                         AS storeproduct_total,
      (SELECT COUNT(*) FROM "StoreProduct" WHERE is_deleted = false)                AS storeproduct_live,
      (SELECT COUNT(*) FROM "StoreProduct" WHERE active = true AND is_deleted=false) AS storeproduct_active,
      (SELECT COUNT(*) FROM "Store")                                                AS store_total,
      (SELECT COUNT(*) FROM merchant_branches)                                      AS branch_total;
  `);
  console.table(counts);

  console.log('\n=== 3. StoreProduct rows whose storeId does NOT match any Store.id (orphaned by FK) ===');
  const storeOrphans: any[] = await prisma.$queryRawUnsafe(`
    SELECT sp.id, sp."storeId", sp.branch_id, sp."productId", sp.active, sp.is_deleted,
           (sp."storeId"::text = sp.branch_id) AS storeid_equals_branch
    FROM "StoreProduct" sp
    LEFT JOIN "Store" s ON s.id = sp."storeId"
    WHERE s.id IS NULL;
  `);
  console.log(`Found ${storeOrphans.length} StoreProduct rows whose storeId has no matching Store.`);
  console.table(storeOrphans.slice(0, 30));

  console.log('\n=== 4. StoreProduct whose branch_id does NOT match any merchant_branches.id ===');
  const branchOrphans: any[] = await prisma.$queryRawUnsafe(`
    SELECT sp.id, sp."storeId", sp.branch_id, sp."productId", sp.active, sp.is_deleted
    FROM "StoreProduct" sp
    LEFT JOIN merchant_branches mb ON mb.id = sp.branch_id
    WHERE sp.branch_id IS NOT NULL AND mb.id IS NULL;
  `);
  console.log(`Found ${branchOrphans.length} StoreProduct rows whose branch_id has no matching branch.`);
  console.table(branchOrphans.slice(0, 30));

  console.log('\n=== 5. StoreProduct rows with branch_id IS NULL ===');
  const nullBranch: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, "storeId", branch_id, "productId", active, is_deleted
    FROM "StoreProduct"
    WHERE branch_id IS NULL;
  `);
  console.log(`Found ${nullBranch.length} StoreProduct rows with branch_id IS NULL.`);
  console.table(nullBranch.slice(0, 30));

  console.log('\n=== 6. The 4 Stores and the count of StoreProducts each currently "owns" via storeId ===');
  const storeMap: any[] = await prisma.$queryRawUnsafe(`
    SELECT s.id AS store_id, s.name, s.merchant_id, s.active,
           (SELECT COUNT(*) FROM "StoreProduct" sp WHERE sp."storeId" = s.id) AS sp_via_storeid
    FROM "Store" s
    ORDER BY s.name;
  `);
  console.table(storeMap);

  console.log('\n=== 7. merchant_branches and the count of StoreProducts referencing each via branch_id ===');
  const branchMap: any[] = await prisma.$queryRawUnsafe(`
    SELECT mb.id AS branch_id, mb.branch_name, mb.merchant_id, mb.is_active,
           (SELECT COUNT(*) FROM "StoreProduct" sp WHERE sp.branch_id = mb.id) AS sp_via_branch
    FROM merchant_branches mb
    ORDER BY mb.branch_name;
  `);
  console.table(branchMap);

  console.log('\n=== 8. Does Store.id == MerchantBranch.id ever coincide? (main-branch UUID-sharing pattern) ===');
  const shared: any[] = await prisma.$queryRawUnsafe(`
    SELECT s.id AS shared_id, s.name AS store_name, mb.branch_name, s.merchant_id AS store_merchant, mb.merchant_id AS branch_merchant
    FROM "Store" s
    JOIN merchant_branches mb ON mb.id::text = s.id::text;
  `);
  console.log(`Found ${shared.length} Store rows whose id matches a merchant_branches.id.`);
  console.table(shared);

  console.log('\n=== 9. consumer-facing query check: get_nearby_stores / GET /stores returns which? ===');
  const activeWithInventory: any[] = await prisma.$queryRawUnsafe(`
    SELECT s.id, s.name, s.active,
           (SELECT COUNT(*) FROM "StoreProduct" sp
              WHERE sp."storeId" = s.id AND sp.active = true AND sp.is_deleted = false) AS active_listings_via_storeid,
           (SELECT COUNT(*) FROM "StoreProduct" sp
              JOIN merchant_branches mb ON mb.id = sp.branch_id
              WHERE mb.merchant_id = s.merchant_id AND sp.active = true AND sp.is_deleted = false) AS active_listings_via_branch_join
    FROM "Store" s
    ORDER BY s.name;
  `);
  console.table(activeWithInventory);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
