import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function run() {
    try {
        const sqlPath = path.join(__dirname, '../../add_custom_product_column.sql');
        console.log(`Reading SQL from: ${sqlPath}`);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL...');
        // Execute raw SQL commands
        // Note: Prisma might not handle multiple statements in one executeRaw, so splitting by ; is safer
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`Running: ${statement.substring(0, 50)}...`);
            await prisma.$executeRawUnsafe(statement);
        }

        console.log('Migration applied successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
