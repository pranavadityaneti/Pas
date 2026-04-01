import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Category Hardening & Cleanup ---');

  // 1. Purge non-scraped mock data
  console.log('Purging mock data (sourceProductId is NULL)...');
  const deletedProducts = await prisma.product.deleteMany({
    where: { sourceProductId: null }
  });
  console.log(`Deleted ${deletedProducts.count} mock products.`);

  // 2. Migration: Re-classify existing products
  // Personal Care/Pharmacy -> Pharmacy & Wellness
  console.log('Migrating Pharmacy/Personal Care keywords to Pharmacy & Wellness vertical...');
  const pharmacyUpdate = await prisma.product.updateMany({
    where: {
      OR: [
        { category: { contains: 'Pharmacy', mode: 'insensitive' } },
        { category: { contains: 'Personal Care', mode: 'insensitive' } },
        { category: { contains: 'Hygiene', mode: 'insensitive' } },
        { category: { contains: 'Beauty', mode: 'insensitive' } },
      ]
    },
    data: { vertical: 'Pharmacy & Wellness' }
  });
  console.log(`Updated ${pharmacyUpdate.count} products to Pharmacy & Wellness.`);

  // 3. Home & Lifestyle (Includes Home Essentials/Cleaning)
  console.log('Migrating Home Essentials keywords to Home & Lifestyle vertical...');
  const lifestyleUpdate = await prisma.product.updateMany({
    where: {
      OR: [
        { category: { contains: 'Home Essentials', mode: 'insensitive' } },
        { category: { contains: 'Cleaning', mode: 'insensitive' } },
        { category: { contains: 'Household', mode: 'insensitive' } },
        { category: { contains: 'Kitchen', mode: 'insensitive' } },
      ]
    },
    data: { vertical: 'Home & Lifestyle' }
  });
  console.log(`Updated ${lifestyleUpdate.count} products to Home & Lifestyle.`);

  // 4. Fruits & Vegetables -> Fruits & Vegetables (Standalone)
  console.log('Migrating Fruits & Vegetables to standalone Vertical...');
  const fvUpdate = await prisma.product.updateMany({
    where: {
      OR: [
        { category: { contains: 'Fruit', mode: 'insensitive' } },
        { category: { contains: 'Vegetable', mode: 'insensitive' } },
        { category: { contains: 'Produce', mode: 'insensitive' } },
      ]
    },
    data: { vertical: 'Fruits & Vegetables' }
  });
  console.log(`Updated ${fvUpdate.count} products to Fruits & Vegetables.`);

  // 5. Grocery & Kirana (Fallback for Dairy/Staples/Snacks/Beverages/Bakery/Confectionery)
  console.log('Ensuring Kirana items are in Grocery & Kirana vertical...');
  const kiranaUpdate = await prisma.product.updateMany({
    where: {
      AND: [
        { vertical: null },
        {
          OR: [
             { category: { contains: 'Dairy', mode: 'insensitive' } },
             { category: { contains: 'Staple', mode: 'insensitive' } },
             { category: { contains: 'Snack', mode: 'insensitive' } },
             { category: { contains: 'Beverage', mode: 'insensitive' } },
             { category: { contains: 'Bakery', mode: 'insensitive' } },
             { category: { contains: 'Confectionery', mode: 'insensitive' } },
          ]
        }
      ]
    },
    data: { vertical: 'Grocery & Kirana' }
  });
  console.log(`Updated ${kiranaUpdate.count} products to Grocery & Kirana.`);

  console.log('--- Hardening Complete ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
