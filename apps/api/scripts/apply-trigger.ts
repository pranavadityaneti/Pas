
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
    const sqlPath = path.resolve(__dirname, '../../../sync_merchants_to_store.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by the end of function definition and trigger drop
    // We'll use a regex that matches the end of the language block '$$ LANGUAGE plpgsql;' 
    // and the end of 'DROP TRIGGER...;'
    const parts = sql.split(/(?<=LANGUAGE plpgsql;|DROP TRIGGER IF EXISTS trg_sync_merchants_to_store ON merchants;)/g);

    console.log(`Applying SQL blocks (${parts.length})...`);
    try {
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed) {
                console.log(`Executing block starting with: ${trimmed.substring(0, 50)}...`);
                await prisma.$executeRawUnsafe(trimmed);
            }
        }
        console.log('Trigger applied successfully.');
    } catch (e) {
        console.error('Failed to apply trigger:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
