const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  try {
      const fkeys = await prisma.$queryRaw`
        SELECT conname,
               conrelid::regclass::text AS table_from,
               confrelid::regclass::text AS table_to
        FROM pg_constraint
        WHERE contype = 'f' AND conrelid::regclass::text IN ('orders', 'order_items', '"StoreProduct"', '"Product"', '"User"', 'User', 'users');
      `;
      console.log(JSON.stringify(fkeys, null, 2));
  } catch (e) {
      console.error(e);
  } finally {
      await prisma.$disconnect();
  }
}
test();
