const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    const userId = "b1f8c148-70cd-4f51-b0db-6a75fba14cb5"; // UUID mock
    try {
        await prisma.$transaction(async (tx) => {
            const updateData = {
                storeName: "Test Store",
                verticalId: 'c307b78e-b924-47a1-a5a7-4405777fa50c', // This must exist in Vertical table!
                phone: "1234567890"
            };
            
            await tx.merchant.upsert({
                where: { id: userId },
                update: updateData,
                create: { id: userId, phone: '1234567890', ...updateData }
            });

            console.log("Merchant upserted!");

            const cityRecord = await tx.city.upsert({
                where: { name: "Test City" },
                update: {},
                create: { id: require('crypto').randomUUID(), name: "Test City", active: true, updatedAt: new Date() }
            });
            console.log("City upserted! City:", cityRecord);

            await tx.store.create({
                data: { id: userId, managerId: userId, name: "Test Store", cityId: cityRecord.id, address: "123", active: false, updatedAt: new Date() }
            });
            console.log("Store created!");
            
            await tx.subscription.create({
                data: {
                    merchantId: userId,
                    amount: 999,
                    currency: 'INR',
                    status: 'success',
                    provider: 'razorpay'
                }
            });
            console.log("Subscription created!");
        });
        console.log("Success!");
    } catch (e) {
        console.error("PRISMA ERROR:", e.message);
    }
}
test();
