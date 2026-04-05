const { Client } = require('pg');

async function main() {
  const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";
  const client = new Client({ connectionString });

  try {
    await client.connect();

    const getColumns = async (table) => {
      const res = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1;
      `, [table]);
      return res.rows;
    };

    console.log("=== COLUMNS FOR orders ===");
    console.table(await getColumns('orders'));

    console.log("=== COLUMNS FOR Order (if any) ===");
    console.table(await getColumns('Order'));

    console.log("=== COLUMNS FOR order_items ===");
    console.table(await getColumns('order_items'));

    console.log("=== COLUMNS FOR OrderItem (if any) ===");
    console.table(await getColumns('OrderItem'));

    console.log("=== COLUMNS FOR stores ===");
    console.table(await getColumns('stores'));

    console.log("=== COLUMNS FOR Store ===");
    console.table(await getColumns('Store'));

  } catch (error) {
    console.error("error:", error);
  } finally {
    await client.end();
  }
}

main();
