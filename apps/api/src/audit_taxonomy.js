const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
});

async function main() {
  try {
    await client.connect();
    
    // Fetch Verticals
    const verticalRes = await client.query('SELECT id, name FROM "Vertical" ORDER BY name ASC');
    const verticals = verticalRes.rows;

    // Fetch Tier2Categories grouped by Vertical
    const categoryRes = await client.query('SELECT id, name, vertical_id FROM "Tier2Category" ORDER BY vertical_id, name ASC');
    const categories = categoryRes.rows;

    console.log('--- AUDIT RESULTS ---');
    console.log('| Vertical ID | Vertical Name | Sub-Categories (Sample) |');
    console.log('| :--- | :--- | :--- |');

    for (const vertical of verticals) {
      const subCats = categories
        .filter(c => c.vertical_id === vertical.id)
        .map(c => c.name)
        .slice(0, 5)
        .join(', ');
      
      console.log(`| ${vertical.id} | ${vertical.name} | ${subCats || 'None'} |`);
    }
    
    // Check for service_type or is_dining in the table columns
    const columnsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Vertical'
    `);
    const columnNames = columnsRes.rows.map(r => r.column_name);
    
    console.log('\n--- SCHEMA AUDIT ---');
    console.log(`Vertical Columns: ${columnNames.join(', ')}`);
    console.log(`is_dining exists: ${columnNames.includes('is_dining')}`);
    console.log(`service_type exists: ${columnNames.includes('service_type')}`);

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await client.end();
  }
}

main();
