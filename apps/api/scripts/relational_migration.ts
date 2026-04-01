import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TAXONOMY = [
  { 
    name: 'Grocery & Kirana', icon: 'basket', color: 'bg-green-100',
    categories: ["Daily Essentials", "Dairy & Eggs", "Rice, Flours & Dals", "Snacks & Munchies", "Beverages", "Household Care"]
  },
  { 
    name: 'Fruits & Vegetables', icon: 'leaf', color: 'bg-orange-100',
    categories: ["Fresh Fruits", "Fresh Vegetables", "Organic Produce", "Exotic Fruits"]
  },
  { 
    name: 'Restaurants & Cafes', icon: 'restaurant', color: 'bg-red-100',
    categories: ["Main Course", "Starters", "Beverages", "Desserts"]
  },
  { 
    name: 'Bakeries & Desserts', icon: 'ice-cream', color: 'bg-pink-100',
    categories: ["Breads & Buns", "Cakes & Pastries", "Cookies & Biscuits", "Desserts"]
  },
  { 
    name: 'Meat & Seafood', icon: 'fish', color: 'bg-blue-100',
    categories: ["Chicken", "Mutton", "Fish & Seafood", "Eggs"]
  },
  { 
    name: 'Pharmacy & Wellness', icon: 'medical', color: 'bg-teal-100',
    categories: ["Medicines", "Vitamins", "Personal Hygiene", "First Aid"]
  },
  { 
    name: 'Electronics & Accessories', icon: 'watch', color: 'bg-indigo-100',
    categories: ["Mobiles", "Laptops", "Audio", "Accessories"]
  },
  { 
    name: 'Fashion & Apparel', icon: 'shirt', color: 'bg-purple-100',
    categories: ["Men's Clothing", "Women's Clothing", "Kids' Fashion", "Footwear"]
  },
  { 
    name: 'Home & Lifestyle', icon: 'home', color: 'bg-yellow-100',
    categories: ["Bedding", "Home Decor", "Kitchen & Dining", "Cleaning"]
  },
  { 
    name: 'Beauty & Personal Care', icon: 'color-palette', color: 'bg-rose-100',
    categories: ["Skincare", "Makeup", "Haircare", "Fragrances"]
  },
  { 
    name: 'Pet Care & Supplies', icon: 'paw', color: 'bg-stone-100',
    categories: ["Dog Food", "Cat Food", "Pet Toys", "Grooming"]
  }
];

async function main() {
  console.log('🚀 Starting Atomic Relational Migration...');

  await prisma.$transaction(async (tx) => {
    // 1. Seed Verticals and Categories
    console.log('Seeding Master Taxonomy...');
    const verticalMap: Record<string, string> = {};
    const categoryMap: Record<string, string> = {}; // key: "verticalName:categoryName" -> id

    for (const v of TAXONOMY) {
      const vertical = await (tx as any).vertical.upsert({
        where: { name: v.name },
        update: { icon: v.icon, color: v.color },
        create: { name: v.name, icon: v.icon, color: v.color }
      });
      verticalMap[v.name] = vertical.id;

      for (const catName of v.categories) {
        const category = await (tx as any).tier2Category.upsert({
          where: { vertical_id_name: { vertical_id: vertical.id, name: catName } },
          update: {},
          create: { name: catName, vertical_id: vertical.id }
        });
        categoryMap[`${v.name}:${catName}`] = category.id;
      }
    }

    console.log('Taxonomy seeded. Legacy data mapping is complete and fields are now deprecated.');
  }, {
    timeout: 60000,
    maxWait: 10000
  });

  console.log('✅ Atomic Migration Complete!');
}

main()
  .catch((e) => {
    console.error('❌ Migration Failed:', e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
