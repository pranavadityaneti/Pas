
import { Client } from 'pg';

const connectionString = 'postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

async function checkRLS() {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();

        console.log('--- RLS Policies for Store ---');
        const res = await client.query(`
            SELECT
                policyname,
                permissive,
                roles,
                cmd,
                qual,
                with_check
            FROM
                pg_policies
            WHERE
                tablename = 'Store';
        `);
        console.table(res.rows);

        console.log('--- Publication Settings ---');
        const pubRes = await client.query(`
            SELECT * FROM pg_publication_tables WHERE tablename = 'Store';
        `);
        console.table(pubRes.rows);

        console.log('--- Replica Identity ---');
        const repRes = await client.query(`
            SELECT
                relname,
                CASE relreplident
                    WHEN 'd' THEN 'default'
                    WHEN 'n' THEN 'nothing'
                    WHEN 'f' THEN 'full'
                    WHEN 'i' THEN 'index'
                END AS replica_identity
            FROM
                pg_class
            WHERE
                relname = 'Store';
        `);
        console.table(repRes.rows);

    } catch (err: any) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkRLS();
