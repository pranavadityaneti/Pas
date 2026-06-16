// Pt 2: identify the actual products behind the 26 orphans + check merchant_id mismatch
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== A. The 4 mystery-storeId products (storeId=5bc7891d, branch_id=NULL) ===');
  const mystery: any[] = await prisma.$queryRawUnsafe(`
    SELECT sp.id AS sp_id, sp.price, sp.stock, sp.active, p.id AS product_id, p.name, p.brand
    FROM "StoreProduct" sp
    JOIN "Product" p ON p.id = sp."productId"
    WHERE sp."storeId" = '5bc7891d-449b-4bea-9756-6890b6232c52'
    ORDER BY p.name;
  `);
  console.table(mystery);

  console.log('\n=== B. The 22 Freshly-branch orphans (Vadapalli + Ravulapalem) ===');
  const freshlyOrphans: any[] = await prisma.$queryRawUnsafe(`
    SELECT sp.id AS sp_id, sp."storeId" AS storeid_branch, mb.branch_name, p.name, sp.price, sp.active, sp.is_deleted
    FROM "StoreProduct" sp
    JOIN merchant_branches mb ON mb.id = sp."storeId"::text
    JOIN "Product" p ON p.id = sp."productId"
    WHERE sp."storeId" IN ('c20b9f8f-4b98-419d-b7aa-01dac3d4c40e','2f25e818-7aff-45c2-baca-31a6322232c4')
    ORDER BY mb.branch_name, p.name;
  `);
  console.log(`${freshlyOrphans.length} rows`);
  console.table(freshlyOrphans);

  console.log('\n=== C. Freshly Store vs branches — merchant_id mismatch detail ===');
  const freshlyAll: any[] = await prisma.$queryRawUnsafe(`
    SELECT 'STORE' AS kind, id, name AS label, merchant_id, active::text AS state
      FROM "Store" WHERE name ILIKE 'freshly%'
    UNION ALL
    SELECT 'BRANCH' AS kind, id, branch_name AS label, merchant_id, COALESCE(is_active::text,'null') AS state
      FROM merchant_branches WHERE branch_name ILIKE 'freshly%' OR id IN (
        'c20b9f8f-4b98-419d-b7aa-01dac3d4c40e','2f25e818-7aff-45c2-baca-31a6322232c4',
        '9143278d-444e-4ee9-b836-f31d5de62e41'
      );
  `);
  console.table(freshlyAll);

  console.log('\n=== D. Is there a Merchant row for 9143278d or ed204d5d? ===');
  const merchants: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, business_name, owner_name FROM "Merchant"
    WHERE id IN ('9143278d-444e-4ee9-b836-f31d5de62e41','ed204d5d-539d-4e50-8b42-9c9de870e9e5');
  `);
  console.table(merchants);

  console.log('\n=== E. Any OrderItem rows referencing the 26 orphan StoreProducts? ===');
  const orderRefs: any[] = await prisma.$queryRawUnsafe(`
    SELECT sp.id AS sp_id, sp."storeId", sp.branch_id, COUNT(oi.id) AS order_item_count
    FROM "StoreProduct" sp
    LEFT JOIN "Store" s ON s.id = sp."storeId"
    LEFT JOIN "OrderItem" oi ON oi."storeProductId" = sp.id
    WHERE s.id IS NULL
    GROUP BY sp.id, sp."storeId", sp.branch_id
    HAVING COUNT(oi.id) > 0
    ORDER BY order_item_count DESC;
  `);
  console.log(`${orderRefs.length} orphan StoreProducts have OrderItem history`);
  console.table(orderRefs);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
