const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    try {
        const result = await prisma.$queryRaw`
            SELECT pg_get_functiondef(p.oid) AS definition
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE p.proname = 'get_nearby_stores'
            AND n.nspname = 'public';
        `;

        if (result && result.length > 0) {
            const definition = result[0].definition;
            console.log('Found definition:\n', definition);
            const backupPath = path.resolve(__dirname, 'legacy_store_rpc_backup.sql');
            fs.writeFileSync(backupPath, definition, 'utf8');
            console.log('Successfully wrote legacy backup to: ' + backupPath);
        } else {
            console.log('Function get_nearby_stores not found in public schema.');
        }

    } catch(err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
