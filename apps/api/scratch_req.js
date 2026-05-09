const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const req = await prisma.order_requests.findUnique({
        where: { id: '905e3dc9-68e7-437d-98c7-cc5ea7e27820' }
    });
    console.log(JSON.stringify(req, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
