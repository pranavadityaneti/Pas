const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Searching for "Tej" or "Stationary" in merchants table ---');
  try {
    const merchants = await prisma.merchant.findMany({
      where: {
        OR: [
          { storeName: { contains: 'Tej', mode: 'insensitive' } },
          { storeName: { contains: 'Stationary', mode: 'insensitive' } },
          { ownerName: { contains: 'Tej', mode: 'insensitive' } },
          { email: { contains: 'Tej', mode: 'insensitive' } }
        ]
      }
    });
    console.log('Found Merchants:', JSON.stringify(merchants, null, 2));

    console.log('\n--- Searching for "Tej" or "Stationary" in User table ---');
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: 'Tej', mode: 'insensitive' } },
          { email: { contains: 'Tej', mode: 'insensitive' } }
        ]
      }
    });
    console.log('Found Users:', JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Prisma search failed:', error);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
