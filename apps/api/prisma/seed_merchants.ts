import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Strategic Merchant Seeding Started ---');

    // 1. Ensure Cities exist (Chennai, Hyderabad, Bangalore)
    const cities = [
        { name: 'Chennai', pincodes: ['600001', '600036', '600041'] },
        { name: 'Hyderabad', pincodes: ['500001', '500032', '500081'] },
        { name: 'Bangalore', pincodes: ['560001', '560034', '560100'] }
    ];

    const cityMap: Record<string, string> = {};
    for (const c of cities) {
        const city = await prisma.city.upsert({
            where: { name: c.name },
            update: {},
            create: {
                name: c.name,
                active: true,
                serviceAreas: {
                    create: c.pincodes.map(p => ({ pincode: p, active: true }))
                }
            },
        });
        cityMap[c.name] = city.id;
        console.log(`City ${c.name} ready.`);
    }

    // 2. Fetch all products to map categories
    const allProducts = await prisma.product.findMany();
    const categoryProducts = (cat: string) => allProducts.filter(p => p.category === cat);

    // 3. Define Merchant Archetypes
    const merchants = [
        // --- Archetype A: Generalist ---
        {
            id: '550e8400-e29b-41d4-a716-446655440001',
            store_name: 'Metro Mega Mart',
            owner_name: 'Aditya Kumar',
            email: 'metro@pas.com',
            city: 'Chennai',
            kyc_status: 'approved',
            status: 'active',
            rating: 4.8,
            categories: ['Dairy', 'Bakery', 'Snacks', 'Staples', 'Condiments', 'Confectionery', 'Grocery', 'Beverages', 'Personal Care', 'Home Essentials']
        },
        {
            id: '550e8400-e29b-41d4-a716-446655440002',
            store_name: 'City Supercenter',
            owner_name: 'Priya Iyer',
            email: 'city@pas.com',
            city: 'Bangalore',
            kyc_status: 'approved',
            status: 'active',
            rating: 4.5,
            categories: ['Dairy', 'Bakery', 'Snacks', 'Staples', 'Condiments', 'Confectionery', 'Grocery', 'Beverages', 'Personal Care', 'Home Essentials']
        },
        // --- Archetype B: Category Specialist ---
        {
            id: '550e8400-e29b-41d4-a716-446655440003',
            store_name: 'The Prime Butcher',
            owner_name: 'David Wilson',
            email: 'butcher@pas.com',
            city: 'Hyderabad',
            kyc_status: 'approved',
            status: 'active',
            rating: 4.9,
            categories: ['Meat']
        },
        {
            id: '550e8400-e29b-41d4-a716-446655440004',
            store_name: 'Healwell Pharmacy',
            owner_name: 'Dr. Sameer',
            email: 'pharmacy@pas.com',
            city: 'Chennai',
            kyc_status: 'pending',
            status: 'active',
            rating: 4.2,
            categories: ['Pharmacy']
        },
        {
            id: '550e8400-e29b-41d4-a716-446655440005',
            store_name: 'Urban Vogue Boutique',
            owner_name: 'Sonia Gupta',
            email: 'fashion@pas.com',
            city: 'Bangalore',
            kyc_status: 'approved',
            status: 'inactive', // Testing inactive
            rating: 4.0,
            categories: ['Fashion']
        },
        {
            id: '550e8400-e29b-41d4-a716-446655440006',
            store_name: 'The Artisanal Baker',
            owner_name: 'Nisha Rai',
            email: 'baker@pas.com',
            city: 'Hyderabad',
            kyc_status: 'approved',
            status: 'active',
            rating: 4.6,
            categories: ['Bakery', 'Confectionery']
        },
        {
            id: '550e8400-e29b-41d4-a716-446655440007',
            store_name: 'Royal Dairy Farm',
            owner_name: 'Manish Singh',
            email: 'dairy@pas.com',
            city: 'Chennai',
            kyc_status: 'pending',
            status: 'active',
            rating: 3.2, // Low rating test
            categories: ['Dairy']
        },
        // --- Archetype C: Local Kirana ---
        {
            id: '550e8400-e29b-41d4-a716-446655440008',
            store_name: 'Ramesh Kirana Store',
            owner_name: 'Ramesh Gupta',
            email: 'ramesh@pas.com',
            city: 'Hyderabad',
            kyc_status: 'pending',
            status: 'active',
            rating: 2.9, // Low rating test
            categories: ['Staples', 'Snacks', 'Beverages']
        },
        {
            id: '550e8400-e29b-41d4-a716-446655440009',
            store_name: 'Vikas General Store',
            owner_name: 'Vikas Reddy',
            email: 'vikas@pas.com',
            city: 'Bangalore',
            kyc_status: 'rejected', // Rejected test
            status: 'active',
            rating: 4.1,
            categories: ['Home Essentials', 'Personal Care']
        },
        {
            id: '550e8400-e29b-41d4-a716-446655440010',
            store_name: 'Sai Traders',
            owner_name: 'Laxman Sai',
            email: 'sai@pas.com',
            city: 'Chennai',
            kyc_status: 'pending',
            status: 'inactive', // Inactive test
            rating: 3.8,
            categories: ['Staples', 'Condiments']
        },
        {
            id: '550e8400-e29b-41d4-a716-446655440011',
            store_name: 'Star Superette',
            owner_name: 'John Doe',
            email: 'star@pas.com',
            city: 'Hyderabad',
            kyc_status: 'approved',
            status: 'active',
            rating: 4.3,
            categories: ['Snacks', 'Beverages', 'Grocery']
        },
        {
            id: '550e8400-e29b-41d4-a716-446655440012',
            store_name: 'Fresh Pick Express',
            owner_name: 'Jane Smith',
            email: 'fresh@pas.com',
            city: 'Bangalore',
            kyc_status: 'rejected', // Rejected test
            status: 'active',
            rating: 4.4,
            categories: ['Grocery', 'Beverages']
        }
    ];

    for (const m of merchants) {
        // 4. Create User
        await prisma.user.upsert({
            where: { email: m.email },
            update: { name: m.owner_name, role: Role.MERCHANT },
            create: {
                id: m.id,
                email: m.email,
                name: m.owner_name,
                passwordHash: 'hashed_password',
                role: Role.MERCHANT
            }
        });

        // 5. Create Prisma Store
        await prisma.store.upsert({
            where: { id: m.id },
            update: { name: m.store_name, active: m.status === 'active', cityId: cityMap[m.city] },
            create: {
                id: m.id,
                name: m.store_name,
                cityId: cityMap[m.city],
                managerId: m.id,
                active: m.status === 'active',
                address: `123 Main St, ${m.city}`,
            }
        });

        // 6. Create Legacy merchants table entry (for UI visibility)
        await prisma.$executeRawUnsafe(`
            INSERT INTO merchants (id, store_name, owner_name, email, phone, city, status, kyc_status, rating, created_at)
            VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            ON CONFLICT (id) DO UPDATE SET 
                store_name = EXCLUDED.store_name, 
                status = EXCLUDED.status, 
                kyc_status = EXCLUDED.kyc_status,
                rating = EXCLUDED.rating
        `, m.id, m.store_name, m.owner_name, m.email, '9876543210', m.city, m.status, m.kyc_status, m.rating);

        // 7. Auto-Inventory Mapping
        const targetProducts = m.categories.flatMap(cat => categoryProducts(cat));

        // Remove existing inventory for clean seed (optional but recommended for reliability)
        await prisma.storeProduct.deleteMany({ where: { storeId: m.id } });

        const inventoryData = targetProducts.map(p => ({
            storeId: m.id,
            productId: p.id,
            price: Math.round(p.mrp * (0.9 + Math.random() * 0.2)), // +/- 10%
            stock: Math.floor(Math.random() * 100) + 10,
            active: true
        }));

        if (inventoryData.length > 0) {
            await prisma.storeProduct.createMany({
                data: inventoryData,
                skipDuplicates: true
            });
            console.log(`Merchant ${m.store_name}: Linked ${inventoryData.length} products.`);
        }
    }

    console.log('--- Strategic Merchant Seeding Completed ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
