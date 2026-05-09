const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('1. Reverting column to TEXT');
        await prisma.$executeRawUnsafe('ALTER TABLE public."StoreProduct" ALTER COLUMN branch_id TYPE text USING branch_id::text;');
        
        console.log('2. Applying Foreign Key constraint');
        await prisma.$executeRawUnsafe('ALTER TABLE public."StoreProduct" ADD CONSTRAINT fk_storeproduct_branch FOREIGN KEY (branch_id) REFERENCES public.merchant_branches(id) ON DELETE CASCADE;');
        
        console.log('CONSTRAINT APPLIED SUCCESSFULLY');
    } catch(err) {
        console.error('SQL Execution Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
