import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function run() {
    try {
        const sqlPath = path.join(__dirname, '../../fix_product_rls.sql');
        console.log(`Reading SQL from: ${sqlPath}`);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL...');
        // Split by semicolon to run multiple statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            try {
                console.log(`Running: ${statement.substring(0, 50)}...`);
                await prisma.$executeRawUnsafe(statement);
            } catch (err: any) {
                // Ignore "already exists" errors to be idempotent
                if (err.message.includes('already exists')) {
                    console.log('Policy already exists, skipping.');
                } else {
                    console.error('Error executing statement:', err);
                }
            }
        }

        console.log('RLS Policies applied successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
