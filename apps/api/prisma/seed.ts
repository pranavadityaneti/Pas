import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding ...');

    // 1. Clean up existing data (optional, but good for dev)
    // await prisma.orderItem.deleteMany();
    // await prisma.order.deleteMany();
    // await prisma.storeProduct.deleteMany();
    // await prisma.product.deleteMany();
    // await prisma.store.deleteMany();
    // await prisma.user.deleteMany();
    // await prisma.serviceArea.deleteMany();
    // await prisma.city.deleteMany();

    // 2. Create City
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

    // 3. Create Super Admin
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

    // 4. Create Global Master Catalog Products
    const productsData = [
        {
            name: 'Fresh Farm Milk (1L)',
            mrp: 40,
            category: 'Dairy',
            brand: 'MilkyWay',
            ean: '8901234567890',
            image: 'https://images.unsplash.com/photo-1555910114-d4ba95cc20e2?auto=format&fit=crop&q=80&w=1080'
        },
        {
            name: 'Whole Wheat Bread',
            mrp: 35,
            category: 'Bakery',
            brand: 'DailyBake',
            ean: '8909876543210',
            image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400'
        },
        {
            name: 'Classic Salted Chips',
            mrp: 20,
            category: 'Snacks',
            brand: 'Crunchy',
            ean: '8901122334455',
            image: 'https://images.unsplash.com/photo-1566478919030-26d9eecbed10?auto=format&fit=crop&q=80&w=400'
        },
        {
            name: 'Basmati Rice (5kg)',
            mrp: 450,
            category: 'Staples',
            brand: 'RoyalFields',
            ean: '8905566778899',
            image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400'
        }
    ];

    const createdProducts = [];
    for (const p of productsData) {
        // Upsert based on EAN if possible, but schema doesn't force unique EAN yet. 
        // We'll create or find by name for now.
        const product = await prisma.product.create({
            data: p
        });
        createdProducts.push(product);
    }
    console.log(`Created ${createdProducts.length} global products.`);

    // 5. Create a Merchant and Store with Inventory
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
                    // Link some products to this store
                    products: {
                        create: [
                            {
                                productId: createdProducts[0].id, // Milk
                                price: 40,
                                stock: 50
                            },
                            {
                                productId: createdProducts[2].id, // Chips
                                price: 20,
                                stock: 100
                            }
                        ]
                    }
                }
            }
        },
    });
    console.log(`Created merchant: ${merchant.email}`);

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
