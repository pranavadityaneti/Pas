const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const result = await prisma.otpVerification.deleteMany({
        where: { phone: '919959777027' }
    });
    console.log(`Deleted ${result.count} OTP requests for 919959777027`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
