import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    try {
        console.log('Reloading Supabase Schema Cache...');
        // This command tells Supabase/PostgREST to refresh its cache
        await prisma.$executeRawUnsafe("NOTIFY pgrst, 'reload schema';");
        console.log('Schema reload command sent successfully!');
    } catch (error) {
        console.error('Failed to reload schema:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
