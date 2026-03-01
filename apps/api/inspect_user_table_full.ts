
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        // Query to get all column details from information_schema
        const result = await prisma.$queryRaw`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'User';
    `;
        console.log('User Table Columns:', result);
    } catch (e) {
        console.error('Error inspecting table:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
