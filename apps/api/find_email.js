const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log('--- USER ---');
        const users = await prisma.$queryRaw`SELECT id, email FROM "User" WHERE email LIKE '%mochi%'`;
        console.log(users);

        console.log('--- MERCHANTS ---');
        const merchants = await prisma.$queryRaw`SELECT id, email FROM merchants WHERE email LIKE '%mochi%'`;
        console.log(merchants);
    } finally {
        await prisma.$disconnect();
    }
}
run();
