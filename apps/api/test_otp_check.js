const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const records = await prisma.otpVerification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Recent OTPs:", records);
}
check().catch(console.error).finally(() => prisma.$disconnect());
