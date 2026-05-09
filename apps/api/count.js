const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
      const result = await prisma.$queryRawUnsafe(`SELECT count(*) as total FROM public."StoreProduct" WHERE branch_id IS NOT NULL`);
      console.log('MIGRATED ROWS:', result[0].total.toString());
  } catch(e) {
      console.error(e);
  } finally {
      await prisma.$disconnect();
  }
}
run();
