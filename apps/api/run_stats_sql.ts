import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();

async function run() {
    try {
        const sql = fs.readFileSync('get_merchant_stats.sql', 'utf8');
        console.log('Running SQL...');
        await prisma.$executeRawUnsafe(sql);
        console.log('SQL executed successfully');
    } catch (error) {
        console.error('SQL failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}
run();
