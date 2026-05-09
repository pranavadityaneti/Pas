const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const products = await prisma.$queryRawUnsafe(`
      SELECT id, "productId", "storeId", branch_id, "createdAt"
      FROM public."StoreProduct"
      ORDER BY "createdAt" DESC
      LIMIT 5
    `);
    console.log(JSON.stringify(products, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
