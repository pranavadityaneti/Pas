const { Client } = require('pg');
const crypto = require('crypto');

const client = new Client({
  connectionString: "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
});

const newVerticals = [
  "Stationery, Gifting & Toys",
  "Electricals, Paints & Automotive",
  "Hardware & Plumbing",
  "Pooja & Festive Needs",
  "Sports & Fitness"
];

async function main() {
  try {
    await client.connect();
    console.log('Connected to database. Starting injection...');

    for (const name of newVerticals) {
      // Check if already exists
      const checkRes = await client.query('SELECT id FROM "Vertical" WHERE name = $1', [name]);
      if (checkRes.rows.length === 0) {
        const id = crypto.randomUUID();
        await client.query(
          'INSERT INTO "Vertical" (id, name, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW())',
          [id, name]
        );
        console.log(`Inserted: ${name} [${id}]`);
      } else {
        console.log(`Already exists: ${name} [${checkRes.rows[0].id}]`);
      }
    }

    const finalCount = await client.query('SELECT count(*) FROM "Vertical"');
    console.log(`Injection complete. Total Verticals: ${finalCount.rows[0].count}`);

  } catch (err) {
    console.error('Injection failed:', err);
  } finally {
    await client.end();
  }
}

main();
