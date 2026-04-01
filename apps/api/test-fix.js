const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDB() {
  try {
    console.log("Adding orders -> User FK...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "orders" 
      ADD CONSTRAINT "orders_user_id_fkey" 
      FOREIGN KEY ("user_id") REFERENCES "User"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log("Success: orders_user_id_fkey");
  } catch (e) {
    console.log("Skipped or failed:", e.message);
  }

  try {
    console.log("Adding order_items -> StoreProduct FK...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "order_items" 
      ADD CONSTRAINT "order_items_store_product_id_fkey" 
      FOREIGN KEY ("store_product_id") REFERENCES "StoreProduct"("id") 
      ON DELETE RESTRICT ON UPDATE CASCADE;
    `);
    console.log("Success: order_items_store_product_id_fkey");
  } catch (e) {
    console.log("Skipped or failed:", e.message);
  }

  try {
     await prisma.$executeRawUnsafe(`NOTIFY pgrst, 'reload schema';`);
     console.log("Reloaded PostgREST Schema Cache");
  } catch (e) {}

  await prisma.$disconnect();
}

fixDB();
