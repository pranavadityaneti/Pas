const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    try {
        const sqlPath = path.resolve(__dirname, 'patch_rls_public.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Applying RLS Rules...');
        // Split by semicolon and ensure not empty
        const commands = sql.split(';').map(cmd => cmd.trim()).filter(cmd => cmd.length > 0);

        for (let i = 0; i < commands.length; i++) {
            console.log(`Executing block ${i+1}/${commands.length}...`);
            await prisma.$executeRawUnsafe(commands[i]);
        }
        
        console.log('Successfully updated RLS policies for public catalog discovery!');

    } catch(err) {
        console.error('Failed to apply SQL:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
