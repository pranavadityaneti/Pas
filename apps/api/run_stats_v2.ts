import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();

async function run() {
    try {
        const sql = fs.readFileSync('get_merchant_stats_v2.sql', 'utf8');
        console.log('Running SQL V2...');
        await prisma.$executeRawUnsafe(sql);
        console.log('SQL V2 executed successfully');
    } catch (error) {
        console.error('SQL V2 failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}
run();
