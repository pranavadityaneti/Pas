const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" });
  await client.connect();

  // 1. All verticals in the system
  const verticals = await client.query(`SELECT id, name FROM "Vertical" ORDER BY name;`);
  console.log("=== ALL VERTICALS IN SYSTEM ===");
  verticals.rows.forEach(v => console.log(`  ${v.name} (${v.id})`));

  // 2. Branch count grouped by vertical
  const grouped = await client.query(`
    SELECT v.name AS vertical_name, COUNT(mb.id) AS branch_count
    FROM merchant_branches mb
    JOIN merchants m ON mb.merchant_id = m.id
    LEFT JOIN "Vertical" v ON m.vertical_id = v.id
    WHERE mb.is_active = true
    GROUP BY v.name
    ORDER BY branch_count DESC;
  `);
  console.log("\n=== ACTIVE BRANCHES BY VERTICAL ===");
  grouped.rows.forEach(r => console.log(`  ${r.vertical_name || 'NULL (no vertical)'}: ${r.branch_count} branches`));

  // 3. Full detail: every active branch with its vertical
  const detail = await client.query(`
    SELECT mb.branch_name, mb.city, mb.latitude, mb.longitude, m.store_name, v.name AS vertical_name
    FROM merchant_branches mb
    JOIN merchants m ON mb.merchant_id = m.id
    LEFT JOIN "Vertical" v ON m.vertical_id = v.id
    WHERE mb.is_active = true
    ORDER BY v.name, mb.branch_name;
  `);
  console.log("\n=== DETAILED BRANCH LIST ===");
  console.log("Branch Name | Store Name | Vertical | City | Has Coords");
  console.log("-".repeat(100));
  detail.rows.forEach(r => {
    const hasCoords = (r.latitude && r.longitude) ? `${r.latitude.toFixed(3)}, ${r.longitude.toFixed(3)}` : 'NO';
    console.log(`${(r.branch_name || '').padEnd(25)} | ${(r.store_name || '').padEnd(20)} | ${(r.vertical_name || 'NULL').padEnd(22)} | ${(r.city || '-').padEnd(12)} | ${hasCoords}`);
  });

  // 4. Check specifically for dining verticals
  const dining = await client.query(`
    SELECT mb.branch_name, m.store_name, v.name
    FROM merchant_branches mb
    JOIN merchants m ON mb.merchant_id = m.id
    JOIN "Vertical" v ON m.vertical_id = v.id
    WHERE v.name IN ('Restaurants & Cafes', 'Bakeries & Desserts')
    AND mb.is_active = true;
  `);
  console.log(`\n=== DINING BRANCHES: ${dining.rows.length} found ===`);
  dining.rows.forEach(r => console.log(`  ${r.branch_name} (${r.name})`));

  await client.end();
}
main();
