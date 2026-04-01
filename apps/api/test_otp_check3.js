const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const records = await prisma.otpVerification.findMany({
    where: { phone: '919959777027' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Recent OTPs for 919959777027:", records);
}
check().catch(console.error).finally(() => prisma.$disconnect());
