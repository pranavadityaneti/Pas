
import { Client } from 'pg';

const connectionString = 'postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

async function checkIndexes() {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();

        console.log('--- Indexes on StoreProduct ---');
        const res = await client.query(`
            SELECT
                i.relname as index_name,
                a.attname as column_name,
                ix.indisunique as is_unique
            FROM
                pg_class t,
                pg_class i,
                pg_index ix,
                pg_attribute a
            WHERE
                t.oid = ix.indrelid
                AND i.oid = ix.indexrelid
                AND a.attrelid = t.oid
                AND a.attnum = ANY(ix.indkey)
                AND t.relname = 'StoreProduct'
            ORDER BY
                t.relname,
                i.relname;
        `);
        console.table(res.rows);

    } catch (err: any) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkIndexes();
