import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('=== C. Freshly Store vs branches ===');
  const c: any[] = await prisma.$queryRawUnsafe(`
    SELECT 'STORE'::text AS kind, id::text AS id, name AS label, merchant_id::text AS merchant_id, active::text AS state
      FROM "Store" WHERE name ILIKE 'freshly%'
    UNION ALL
    SELECT 'BRANCH'::text AS kind, id::text AS id, branch_name AS label, merchant_id::text AS merchant_id, COALESCE(is_active::text,'null') AS state
      FROM merchant_branches WHERE branch_name ILIKE 'freshly%';
  `);
  console.table(c);

  console.log('\n=== D. Merchant rows for the relevant ids ===');
  const d: any[] = await prisma.$queryRawUnsafe(`
    SELECT id::text, business_name, owner_name FROM "Merchant"
    WHERE id::text IN ('9143278d-444e-4ee9-b836-f31d5de62e41','ed204d5d-539d-4e50-8b42-9c9de870e9e5','71fa7b7c-d5a2-4f42-8e4b-61383da57c54','3c5308b8-f8f5-41d5-92a4-54d8a41f8ff3');
  `);
  console.table(d);

  console.log('\n=== E. OrderItem references to the 26 orphan StoreProducts ===');
  const e: any[] = await prisma.$queryRawUnsafe(`
    SELECT sp.id AS sp_id, sp."storeId"::text AS storeid, sp.branch_id, COUNT(oi.id) AS order_item_count
    FROM "StoreProduct" sp
    LEFT JOIN "Store" s ON s.id::text = sp."storeId"::text
    LEFT JOIN "OrderItem" oi ON oi."storeProductId" = sp.id
    WHERE s.id IS NULL
    GROUP BY sp.id, sp."storeId", sp.branch_id
    HAVING COUNT(oi.id) > 0
    ORDER BY order_item_count DESC;
  `);
  console.log(`${e.length} orphan StoreProducts have OrderItem history`);
  console.table(e);
}
main().catch((err)=>{console.error(err);process.exit(1)}).finally(async()=>{await prisma.$disconnect();});
