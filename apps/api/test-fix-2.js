const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDB() {
  try {
    console.log("Altering orders.user_id to text...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "orders" ALTER COLUMN "user_id" TYPE text;
    `);
    
    console.log("Adding orders -> User FK...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "orders" 
      ADD CONSTRAINT "orders_user_id_fkey" 
      FOREIGN KEY ("user_id") REFERENCES "User"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log("Success: orders_user_id_fkey");
  } catch (e) {
    console.log("Failed:", e.message);
  }
  
  await prisma.$executeRawUnsafe(`NOTIFY pgrst, 'reload schema';`);
  await prisma.$disconnect();
}

fixDB();
