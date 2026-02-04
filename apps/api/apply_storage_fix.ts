import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function run() {
    try {
        const sqlPath = path.join(__dirname, 'fix_storage_select_policy.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('--- APPLYING STORAGE RLS FIXES ---');

        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            await prisma.$executeRawUnsafe(statement);
        }

        console.log('--- RE-CHECKING STORAGE POLICIES ---');
        const policies = await prisma.$queryRaw`
            SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
        `;
        console.table(policies);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
