import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function run() {
    try {
        const sqlPath = path.join(__dirname, 'fix_merchant_rls_admin.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('--- APPLYING RLS FIXES ---');

        // Split by semicolon to execute multiple statements if needed, 
        // though executeRawUnsafe might handle it depending on the driver.
        // Prisma pg driver usually likes one statement per call, so let's split.
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            await prisma.$executeRawUnsafe(statement);
        }

        console.log('--- RE-CHECKING RLS POLICIES ---');
        const policies = await prisma.$queryRaw`
            SELECT * FROM pg_policies WHERE tablename = 'merchants';
        `;
        console.table(policies);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
