import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const counts = await prisma.profiles.groupBy({
    by: ['tier'],
    _count: { id: true }
  });
  console.log(JSON.stringify(counts, null, 2));
  await prisma.$disconnect();
}
run();
