import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTables() {
  const tables: any[] = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `;
  console.log('--- TABLES IN public SCHEMA ---');
  console.log(JSON.stringify(tables.map(t => t.table_name), null, 2));

  // Check columns for 'orders' or 'Order' if they exist
  const tableName = tables.find(t => t.table_name.toLowerCase() === 'orders' || t.table_name === 'Order')?.table_name;
  if (tableName) {
    console.log(`--- COLUMNS IN ${tableName} ---`);
    const columns: any[] = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = '${tableName}';
    `);
    console.log(JSON.stringify(columns, null, 2));
  }
}

checkTables()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
