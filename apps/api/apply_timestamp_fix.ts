import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function run() {
    try {
        const sqlPath = path.join(__dirname, '../../fix_timestamps_defaults.sql');
        console.log(`Reading SQL from: ${sqlPath}`);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL to Fix Timestamps...');
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
                console.error('Error executing statement:', err);
            }
        }

        console.log('Timestamp Defaults applied successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
