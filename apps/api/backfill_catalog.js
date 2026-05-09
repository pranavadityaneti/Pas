const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('1. Executing SQL Migration & Backfill...');
        const sqlPath = path.resolve(__dirname, 'migrate_catalog.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        const commands = sql.split(';').map(cmd => cmd.trim()).filter(cmd => cmd.length > 0);
        for (const cmd of commands) {
            const rowsAffected = await prisma.$executeRawUnsafe(cmd);
            if (cmd.startsWith('UPDATE') || cmd.startsWith('update')) {
                console.log(`[SUCCESS] Backfill Complete! Migrated: ${rowsAffected} rows.`);
            }
        }
        console.log('SQL operations finished successfully.');

    } catch(err) {
        console.error('Migration failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
