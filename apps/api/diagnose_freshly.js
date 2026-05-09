const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('--- 1. Querying merchant_branches ---');
    const branches = await prisma.$queryRawUnsafe(`
      SELECT id, branch_name, is_active, latitude, longitude, merchant_id 
      FROM public.merchant_branches 
      WHERE branch_name ILIKE '%Freshly%'
    `);
    console.log(branches.length > 0 ? branches : 'No physical branches found matching *Freshly*');

    console.log('\n--- 2. Querying merchants ---');
    const merchants = await prisma.merchant.findMany({
      where: {
        OR: [
          { storeName: { contains: 'Freshly', mode: 'insensitive' } },
          { branchName: { contains: 'Freshly', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        storeName: true,
        status: true
      }
    });
    console.log(merchants.length > 0 ? merchants : 'No merchants found matching *Freshly*');

  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
