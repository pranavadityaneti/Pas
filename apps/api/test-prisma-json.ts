import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const items = [{ name: 'Test', quantity: 2, price: 10 }];
    const req = await prisma.order_requests.create({
        data: {
            consumer_user_id: '868172ee-c1bb-4573-8bc7-5ab1792ce309',
            store_id: 'test-store',
            branch_id: 'test-branch',
            store_name: 'Test Store',
            items: items,
            subtotal: 20,
            status: 'PENDING',
            expires_at: new Date(Date.now() + 120000)
        }
    });
    console.log('NEW ROW ITEMS TYPE:', typeof req.items);
    console.log('NEW ROW ITEMS (Array check):', Array.isArray(req.items));
    console.log('NEW ROW ITEMS RAW:', req.items);
    
    const oldReq = await prisma.order_requests.findFirst({
        orderBy: { created_at: 'asc' }
    });
    console.log('OLD ROW ITEMS TYPE:', typeof oldReq?.items);
    console.log('OLD ROW ITEMS (Array check):', Array.isArray(oldReq?.items));
    console.log('OLD ROW ITEMS RAW:', oldReq?.items);

    await prisma.order_requests.delete({ where: { id: req.id } });
}
main().catch(console.error).finally(() => prisma.$disconnect());
