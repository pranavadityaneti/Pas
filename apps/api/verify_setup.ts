
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Verifying System Setup ---');

    try {
        // 1. Check City Data
        const cityCount = await prisma.city.count();
        console.log(`[Check] Cities found: ${cityCount}`);

        if (cityCount === 0) {
            console.warn('[Warning] No cities found! Store creation trigger might fail.');
            // Attempt to seed Hyderabad
            const city = await prisma.city.create({
                data: { name: 'Hyderabad', active: true }
            });
            console.log('[Fix] Seeded City: Hyderabad');
        } else {
            console.log('[OK] City table has data.');
        }

        // 2. Check Service Role access to Authenticated tables
        // (Simulated by just querying them)
        try {
            await prisma.notification.findMany({ take: 1 });
            console.log('[OK] Notification table verified.');
        } catch (e) {
            console.error('[Error] Notification table access failed:', e);
        }

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
