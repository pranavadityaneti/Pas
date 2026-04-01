import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Store & Merchant Vertical Migration ---');

  // 1. Migrate Stores
  const stores = await prisma.store.findMany({
    where: { vertical: null }
  });
  console.log(`Found ${stores.length} stores with null vertical.`);

  for (const store of stores) {
    let vertical = 'Grocery & Kirana'; // Default
    const name = store.name?.toLowerCase() || '';
    
    if (name.includes('fruit') || name.includes('veg')) vertical = 'Fruits & Vegetables';
    else if (name.includes('pharmacy') || name.includes('wellness') || name.includes('med')) vertical = 'Pharmacy & Wellness';
    else if (name.includes('meat') || name.includes('fish') || name.includes('chicken')) vertical = 'Meat & Seafood';
    else if (name.includes('bake') || name.includes('cake') || name.includes('dessert')) vertical = 'Bakeries & Desserts';
    else if (name.includes('rest') || name.includes('cafe')) vertical = 'Restaurants & Cafes';

    await prisma.store.update({
      where: { id: store.id },
      data: { vertical }
    });
  }
  console.log('Stores migrated.');

  // 2. Migrate Merchants
  const merchants = await prisma.merchant.findMany({
    where: { vertical: null }
  });
  console.log(`Found ${merchants.length} merchants with null vertical.`);

  for (const merchant of merchants) {
    let vertical = 'Grocery & Kirana';
    const legacyCat = merchant.category || '';
    
    // Mapping legacy category names to new verticals
    if (legacyCat.includes('Supermarket') || legacyCat.includes('Grocery')) vertical = 'Grocery & Kirana';
    else if (legacyCat.includes('Meat') || legacyCat.includes('Seafood')) vertical = 'Meat & Seafood';
    else if (legacyCat.includes('Pharmacy') || legacyCat.includes('Wellness')) vertical = 'Pharmacy & Wellness';
    else if (legacyCat.includes('Restaurant') || legacyCat.includes('Cafe')) vertical = 'Restaurants & Cafes';
    else if (legacyCat.includes('Bakery') || legacyCat.includes('Dessert')) vertical = 'Bakeries & Desserts';
    else if (legacyCat.includes('Electronics')) vertical = 'Electronics & Accessories';
    else if (legacyCat.includes('Fashion')) vertical = 'Fashion & Apparel';
    else if (legacyCat.includes('Home') || legacyCat.includes('Lifestyle')) vertical = 'Home & Lifestyle';
    else if (legacyCat.includes('Beauty') || legacyCat.includes('Personal')) vertical = 'Beauty & Personal Care';
    else if (legacyCat.includes('Pet')) vertical = 'Pet Care & Supplies';

    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { vertical }
    });
  }
  console.log('Merchants migrated.');

  console.log('--- Migration Complete ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
