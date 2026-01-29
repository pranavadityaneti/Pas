import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding ...');

    // 1. Create City
    const chennai = await prisma.city.upsert({
        where: { name: 'Chennai' },
        update: {},
        create: {
            name: 'Chennai',
            active: true,
            serviceAreas: {
                create: [
                    { pincode: '600001', active: true },
                    { pincode: '600036', active: true },
                    { pincode: '600041', active: true }
                ]
            }
        },
    });
    console.log(`Created city: ${chennai.name}`);

    // 2. Create Super Admin
    await prisma.user.upsert({
        where: { email: 'admin@pas.com' },
        update: {},
        create: {
            email: 'admin@pas.com',
            name: 'Super Admin',
            passwordHash: 'hashed_secret',
            role: Role.SUPER_ADMIN,
        },
    });

    // 3. Global Master Catalog Products (65 Products - 5 per Category)
    const productsData = [
        // --- Dairy ---
        { name: 'Fresh Farm Milk (1L)', mrp: 44, category: 'Dairy', brand: 'MilkyWay', ean: 'DAIR001', image: 'https://images.unsplash.com/photo-1550583724-7d39d0a58b4b?w=400', unitType: 'L', unitValue: 1, hsnCode: '0401', gstRate: 5 },
        { name: 'Salted Butter (500g)', mrp: 250, category: 'Dairy', brand: 'Amul', ean: 'DAIR002', image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400', unitType: 'g', unitValue: 500, hsnCode: '0405', gstRate: 12 },
        { name: 'Greek Yogurt (200g)', mrp: 60, category: 'Dairy', brand: 'Epigamia', ean: 'DAIR003', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400', unitType: 'g', unitValue: 200, hsnCode: '0403', gstRate: 5 },
        { name: 'Mozzarella Cheese (200g)', mrp: 180, category: 'Dairy', brand: 'GoCheese', ean: 'DAIR004', image: 'https://images.unsplash.com/photo-1552767059-ce182ead6c1b?w=400', unitType: 'g', unitValue: 200, hsnCode: '0406', gstRate: 12 },
        { name: 'Fresh Paneer (200g)', mrp: 90, category: 'Dairy', brand: 'MotherDairy', ean: 'DAIR005', image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400', unitType: 'g', unitValue: 200, hsnCode: '0406', gstRate: 5 },

        // --- Bakery ---
        { name: 'Whole Wheat Bread', mrp: 45, category: 'Bakery', brand: 'HarvestGold', ean: 'BAKE001', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', unitType: 'pc', unitValue: 1, hsnCode: '1901', gstRate: 5 },
        { name: 'Chocolate Chip Cookies', mrp: 120, category: 'Bakery', brand: 'Sunfeast', ean: 'BAKE002', image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400', unitType: 'g', unitValue: 250, hsnCode: '1905', gstRate: 18 },
        { name: 'Butter Croissants (2pk)', mrp: 150, category: 'Bakery', brand: 'LaBoulange', ean: 'BAKE003', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400', unitType: 'pc', unitValue: 2, hsnCode: '1905', gstRate: 18 },
        { name: 'Fruit Cake (500g)', mrp: 350, category: 'Bakery', brand: 'Elite', ean: 'BAKE004', image: 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400', unitType: 'g', unitValue: 500, hsnCode: '1905', gstRate: 18 },
        { name: 'Garlic Rusks (300g)', mrp: 80, category: 'Bakery', brand: 'Parle', ean: 'BAKE005', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', unitType: 'g', unitValue: 300, hsnCode: '1905', gstRate: 12 },

        // --- Snacks ---
        { name: 'Classic Salted Chips', mrp: 20, category: 'Snacks', brand: 'Lays', ean: 'SNAC001', image: 'https://images.unsplash.com/photo-1566478919030-26d9eecbed10?w=400', unitType: 'g', unitValue: 50, hsnCode: '2005', gstRate: 12 },
        { name: 'Spicy Namkeen (200g)', mrp: 50, category: 'Snacks', brand: 'Haldiram', ean: 'SNAC002', image: 'https://images.unsplash.com/photo-1601050630597-3f870c574066?w=400', unitType: 'g', unitValue: 200, hsnCode: '2106', gstRate: 12 },
        { name: 'Caramel Popcorn', mrp: 99, category: 'Snacks', brand: 'ACT II', ean: 'SNAC003', image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400', unitType: 'g', unitValue: 150, hsnCode: '1904', gstRate: 18 },
        { name: 'Instant Masala Noodles', mrp: 15, category: 'Snacks', brand: 'Maggi', ean: 'SNAC004', image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400', unitType: 'pc', unitValue: 1, hsnCode: '1902', gstRate: 12 },
        { name: 'Roasted Makhana (100g)', mrp: 180, category: 'Snacks', brand: 'Farmley', ean: 'SNAC005', image: 'https://images.unsplash.com/photo-1601050630597-3f870c574066?w=400', unitType: 'g', unitValue: 100, hsnCode: '2106', gstRate: 5 },

        // --- Staples ---
        { name: 'Basmati Rice (5kg)', mrp: 650, category: 'Staples', brand: 'IndiaGate', ean: 'STAP001', image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400', unitType: 'kg', unitValue: 5, hsnCode: '1006', gstRate: 5 },
        { name: 'Chakki Fresh Atta (10kg)', mrp: 420, category: 'Staples', brand: 'Aashirvaad', ean: 'STAP002', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', unitType: 'kg', unitValue: 10, hsnCode: '1101', gstRate: 0 },
        { name: 'Moong Dal (1kg)', mrp: 160, category: 'Staples', brand: 'TataSampann', ean: 'STAP003', image: 'https://images.unsplash.com/photo-1585994192730-981f21eb6d7d?w=400', unitType: 'kg', unitValue: 1, hsnCode: '0713', gstRate: 0 },
        { name: 'Refined Sugar (1kg)', mrp: 50, category: 'Staples', brand: 'Uttam', ean: 'STAP004', image: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=400', unitType: 'kg', unitValue: 1, hsnCode: '1701', gstRate: 5 },
        { name: 'Sunflower Oil (1L)', mrp: 180, category: 'Staples', brand: 'Fortune', ean: 'STAP005', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400', unitType: 'L', unitValue: 1, hsnCode: '1512', gstRate: 5 },

        // --- Condiments ---
        { name: 'Tomato Ketchup (1kg)', mrp: 140, category: 'Condiments', brand: 'Kissan', ean: 'COND001', image: 'https://images.unsplash.com/photo-1589135398302-388cd3411cc8?w=400', unitType: 'kg', unitValue: 1, hsnCode: '2103', gstRate: 12 },
        { name: 'Eggless Mayonnaise (250g)', mrp: 95, category: 'Condiments', brand: 'FunFoods', ean: 'COND002', image: 'https://images.unsplash.com/photo-1588631163456-4c70d4bc3a67?w=400', unitType: 'g', unitValue: 250, hsnCode: '2103', gstRate: 12 },
        { name: 'Basil Pesto Sauce', mrp: 299, category: 'Condiments', brand: 'Barilla', ean: 'COND003', image: 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?w=400', unitType: 'g', unitValue: 190, hsnCode: '2103', gstRate: 12 },
        { name: 'Turmeric Powder (200g)', mrp: 60, category: 'Condiments', brand: 'Catch', ean: 'COND004', image: 'https://images.unsplash.com/photo-1615485245834-4bc6ca2c6383?w=400', unitType: 'g', unitValue: 200, hsnCode: '0910', gstRate: 5 },
        { name: 'Mango Pickle (500g)', mrp: 150, category: 'Condiments', brand: 'MothersRecipe', ean: 'COND005', image: 'https://images.unsplash.com/photo-1601050630597-3f870c574066?w=400', unitType: 'g', unitValue: 500, hsnCode: '2001', gstRate: 12 },

        // --- Confectionery ---
        { name: 'Milk Chocolate Bar', mrp: 80, category: 'Confectionery', brand: 'Cadbury', ean: 'CONF001', image: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400', unitType: 'g', unitValue: 80, hsnCode: '1806', gstRate: 18 },
        { name: 'Fruit Gummies (100g)', mrp: 50, category: 'Confectionery', brand: 'Haribo', ean: 'CONF002', image: 'https://images.unsplash.com/photo-1582050058244-43c7bdec539c?w=400', unitType: 'g', unitValue: 100, hsnCode: '1704', gstRate: 18 },
        { name: 'Hazelnut Wafer', mrp: 40, category: 'Confectionery', brand: 'Kinder', ean: 'CONF003', image: 'https://images.unsplash.com/photo-1499195333224-3ce974eecfb4?w=400', unitType: 'g', unitValue: 40, hsnCode: '1905', gstRate: 18 },
        { name: 'Mint Chewing Gum', mrp: 10, category: 'Confectionery', brand: 'Orbit', ean: 'CONF004', image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=400', unitType: 'pc', unitValue: 1, hsnCode: '1704', gstRate: 18 },
        { name: 'Mini Marshmallows', mrp: 120, category: 'Confectionery', brand: 'Kraft', ean: 'CONF005', image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400', unitType: 'g', unitValue: 150, hsnCode: '1704', gstRate: 18 },

        // --- Grocery ---
        { name: 'Canned Sweet Corn', mrp: 75, category: 'Grocery', brand: 'DelMonte', ean: 'GROC001', image: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400', unitType: 'g', unitValue: 450, hsnCode: '2005', gstRate: 12 },
        { name: 'Mixed Dry Fruits (250g)', mrp: 450, category: 'Grocery', brand: 'Happilo', ean: 'GROC002', image: 'https://images.unsplash.com/photo-1596591606975-97ee5cef3a1e?w=400', unitType: 'g', unitValue: 250, hsnCode: '0802', gstRate: 12 },
        { name: 'White Poha (500g)', mrp: 60, category: 'Grocery', brand: 'Fortune', ean: 'GROC003', image: 'https://images.unsplash.com/photo-1589412225893-a08b907c17b3?w=400', unitType: 'g', unitValue: 500, hsnCode: '1904', gstRate: 5 },
        { name: 'Roasted Vermicelli', mrp: 45, category: 'Grocery', brand: 'Bambino', ean: 'GROC004', image: 'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?w=400', unitType: 'g', unitValue: 500, hsnCode: '1902', gstRate: 5 },
        { name: 'Premium Tea Dust (500g)', mrp: 320, category: 'Grocery', brand: 'RedLabel', ean: 'GROC005', image: 'https://images.unsplash.com/photo-1544787210-28272d96677f?w=400', unitType: 'g', unitValue: 500, hsnCode: '0902', gstRate: 5 },

        // --- Beverages ---
        { name: 'Cold Brew Coffee (250ml)', mrp: 120, category: 'Beverages', brand: 'SleepyOwl', ean: 'BEVE001', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400', unitType: 'ml', unitValue: 250, hsnCode: '2101', gstRate: 12 },
        { name: 'Orange Fruit Juice (1L)', mrp: 110, category: 'Beverages', brand: 'Real', ean: 'BEVE002', image: 'https://images.unsplash.com/photo-1621506289937-4ec7561f77bd?w=400', unitType: 'L', unitValue: 1, hsnCode: '2009', gstRate: 12 },
        { name: 'Sparkling Soda (500ml)', mrp: 20, category: 'Beverages', brand: 'Kinley', ean: 'BEVE003', image: 'https://images.unsplash.com/photo-1622483767028-3f66f361406d?w=400', unitType: 'ml', unitValue: 500, hsnCode: '2202', gstRate: 18 },
        { name: 'Energy Drink (250ml)', mrp: 60, category: 'Beverages', brand: 'RedBull', ean: 'BEVE004', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1538c?w=400', unitType: 'ml', unitValue: 250, hsnCode: '2202', gstRate: 28 },
        { name: 'Mineral Water (1L)', mrp: 20, category: 'Beverages', brand: 'Bisleri', ean: 'BEVE005', image: 'https://images.unsplash.com/photo-1523362628744-4cddf7679bc2?w=400', unitType: 'L', unitValue: 1, hsnCode: '2201', gstRate: 18 },

        // --- Personal Care ---
        { name: 'Anti-Dandruff Shampoo', mrp: 240, category: 'Personal Care', brand: 'Head&Shoulders', ean: 'PERS001', image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400', unitType: 'ml', unitValue: 400, hsnCode: '3305', gstRate: 18 },
        { name: 'Moisturizing Soap', mrp: 45, category: 'Personal Care', brand: 'Dove', ean: 'PERS002', image: 'https://images.unsplash.com/photo-1600857062241-98e5dba7f214?w=400', unitType: 'g', unitValue: 100, hsnCode: '3401', gstRate: 18 },
        { name: 'Whitening Toothpaste', mrp: 95, category: 'Personal Care', brand: 'Colgate', ean: 'PERS003', image: 'https://images.unsplash.com/photo-1559591937-e68fb3305e4d?w=400', unitType: 'g', unitValue: 150, hsnCode: '3306', gstRate: 18 },
        { name: 'Foaming Face Wash', mrp: 199, category: 'Personal Care', brand: 'Neutrogena', ean: 'PERS004', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a13?w=400', unitType: 'ml', unitValue: 150, hsnCode: '3304', gstRate: 18 },
        { name: 'Sport Deodorant Spray', mrp: 220, category: 'Personal Care', brand: 'Nike', ean: 'PERS005', image: 'https://images.unsplash.com/photo-1594122230689-45899d9e6f69?w=400', unitType: 'ml', unitValue: 150, hsnCode: '3307', gstRate: 18 },

        // --- Home Essentials ---
        { name: 'Liquid Detergent (1L)', mrp: 190, category: 'Home Essentials', brand: 'SurfExcel', ean: 'HOME001', image: 'https://images.unsplash.com/photo-1610557892470-55d9e80e0bce?w=400', unitType: 'L', unitValue: 1, hsnCode: '3402', gstRate: 18 },
        { name: 'Pine Floor Cleaner (1L)', mrp: 145, category: 'Home Essentials', brand: 'Lizol', ean: 'HOME002', image: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=400', unitType: 'L', unitValue: 1, hsnCode: '3402', gstRate: 18 },
        { name: 'Soft Facial Tissues', mrp: 80, category: 'Home Essentials', brand: 'Paseo', ean: 'HOME003', image: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=400', unitType: 'pc', unitValue: 200, hsnCode: '4818', gstRate: 12 },
        { name: 'Biodegradable Garbage Bags', mrp: 120, category: 'Home Essentials', brand: 'EcoGuard', ean: 'HOME004', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400', unitType: 'pc', unitValue: 30, hsnCode: '3923', gstRate: 18 },
        { name: 'Lemon Dishwash Liquid', mrp: 110, category: 'Home Essentials', brand: 'Vim', ean: 'HOME005', image: 'https://images.unsplash.com/photo-1610940882244-596646864115?w=400', unitType: 'ml', unitValue: 750, hsnCode: '3402', gstRate: 18 },

        // --- Fashion ---
        { name: 'Classic White Polo T-Shirt', mrp: 999, category: 'Fashion', brand: 'UrbanStyle', ean: 'FASH001', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400', unitType: 'pc', unitValue: 1, hsnCode: '6109', gstRate: 5 },
        { name: 'Slim Fit Denim Jeans', mrp: 1999, category: 'Fashion', brand: 'RoughRoad', ean: 'FASH002', image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400', unitType: 'pc', unitValue: 1, hsnCode: '6203', gstRate: 5 },
        { name: 'Leather Bifold Wallet', mrp: 750, category: 'Fashion', brand: 'Cuero', ean: 'FASH003', image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400', unitType: 'pc', unitValue: 1, hsnCode: '4202', gstRate: 12 },
        { name: 'Women Floral Summer Dress', mrp: 1499, category: 'Fashion', brand: 'Bloom', ean: 'FASH004', image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400', unitType: 'pc', unitValue: 1, hsnCode: '6204', gstRate: 5 },
        { name: 'Men\'s Running Sneakers', mrp: 2499, category: 'Fashion', brand: 'Velocity', ean: 'FASH005', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', unitType: 'pair', unitValue: 1, hsnCode: '6404', gstRate: 18 },

        // --- Pharmacy ---
        { name: 'Paracetamol 500mg', mrp: 30, category: 'Pharmacy', brand: 'HealQuick', ean: 'PHAR001', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400', unitType: 'pc', unitValue: 15, hsnCode: '3004', gstRate: 12 },
        { name: 'Antiseptic Liquid (500ml)', mrp: 180, category: 'Pharmacy', brand: 'SafeGuard', ean: 'PHAR002', image: 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?w=400', unitType: 'ml', unitValue: 500, hsnCode: '3808', gstRate: 12 },
        { name: 'Hand Sanitizer (100ml)', mrp: 50, category: 'Pharmacy', brand: 'PureHands', ean: 'PHAR003', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400', unitType: 'ml', unitValue: 100, hsnCode: '3808', gstRate: 18 },
        { name: 'Multivitamin Supplements', mrp: 450, category: 'Pharmacy', brand: 'VitaBoost', ean: 'PHAR004', image: 'https://images.unsplash.com/photo-1550572017-ed2352a09a51?w=400', unitType: 'pc', unitValue: 30, hsnCode: '2106', gstRate: 18 },
        { name: 'Adhesive Bandages (20pk)', mrp: 60, category: 'Pharmacy', brand: 'AidFlex', ean: 'PHAR005', image: 'https://images.unsplash.com/photo-1603398938378-e54eab446ddd?w=400', unitType: 'pc', unitValue: 20, hsnCode: '3005', gstRate: 12 },

        // --- Meat ---
        { name: 'Fresh Chicken Breast (500g)', mrp: 250, category: 'Meat', brand: 'FreshMeat', ean: 'MEAT001', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400', unitType: 'g', unitValue: 500, hsnCode: '0207', gstRate: 0 },
        { name: 'Mutton Curry Cut (1kg)', mrp: 850, category: 'Meat', brand: 'HeritageButchery', ean: 'MEAT002', image: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400', unitType: 'kg', unitValue: 1, hsnCode: '0204', gstRate: 0 },
        { name: 'Atlantic Salmon Fillet', mrp: 1200, category: 'Meat', brand: 'OceanFine', ean: 'MEAT003', image: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=400', unitType: 'g', unitValue: 250, hsnCode: '0302', gstRate: 5 },
        { name: 'Premium Pork Sausages', mrp: 400, category: 'Meat', brand: 'DeliTreats', ean: 'MEAT004', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400', unitType: 'g', unitValue: 500, hsnCode: '1601', gstRate: 12 },
        { name: 'Frozen Beef Patties', mrp: 320, category: 'Meat', brand: 'BurgerPro', ean: 'MEAT005', image: 'https://images.unsplash.com/photo-1594212699903-ec8a3eea50f6?w=400', unitType: 'pc', unitValue: 4, hsnCode: '0202', gstRate: 5 }
    ];

    const createdProducts = [];
    for (const p of productsData) {
        // Upsert by name for clean seeding/patching
        const product = await prisma.product.upsert({
            where: { id: (await prisma.product.findFirst({ where: { name: p.name } }))?.id || '00000000-0000-0000-0000-000000000000' },
            update: p,
            create: p
        });
        createdProducts.push(product);
    }
    console.log(`Successfully seeded/updated ${createdProducts.length} global products.`);

    // 4. Create a Merchant and Store with Inventory (Linking a few items)
    const merchant = await prisma.user.upsert({
        where: { email: 'merchant@store.com' },
        update: {},
        create: {
            email: 'merchant@store.com',
            name: 'Ramesh Store Owner',
            passwordHash: 'hashed_secret',
            role: Role.MERCHANT,
            managedStore: {
                create: {
                    name: 'Ramesh General Stores',
                    cityId: chennai.id,
                    address: '123, Gandhi Road, Chennai',
                    active: true,
                    products: {
                        create: [
                            { productId: createdProducts[0].id, price: 44, stock: 50 },
                            { productId: createdProducts[5].id, price: 45, stock: 30 },
                            { productId: createdProducts[10].id, price: 20, stock: 100 }
                        ]
                    }
                }
            }
        },
    });
    console.log(`Created/Verified merchant: ${merchant.email}`);

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
