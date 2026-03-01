
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from api root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncStoreToMerchant(storeId: string) {
    console.log(`Syncing Store ID: ${storeId}`);

    try {
        // 1. Fetch Full Store Details from Postgres
        const fullStore = await prisma.store.findUnique({
            where: { id: storeId },
            include: {
                manager: true,
                city: true
            }
        });

        if (!fullStore) {
            console.error('Store not found in Postgres/Prisma');
            return;
        }

        console.log(`Found Store: ${fullStore.name}, Manager: ${fullStore.manager?.email}`);

        if (!fullStore.manager) {
            console.error('Store has no manager linked. Cannot sync.');
            return;
        }

        // 2. Prepare Payload for 'merchants' table
        const merchantPayload = {
            id: fullStore.id,
            store_name: fullStore.name,
            owner_name: fullStore.manager.name || 'Unknown',
            email: fullStore.manager.email,
            phone: fullStore.manager.phone || '',
            city: fullStore.city?.name || 'Unknown',
            address: fullStore.address,
            has_branches: false,
            status: fullStore.active ? 'active' : 'inactive',
            created_at: fullStore.createdAt.toISOString(),
            updated_at: new Date().toISOString()
            // Add other fields as defaults if necessary for the table constraints
        };

        console.log('Upserting into merchants table...', merchantPayload);

        // 3. Upsert into Supabase
        const { data, error } = await supabase
            .from('merchants')
            .upsert(merchantPayload, { onConflict: 'id' })
            .select();

        if (error) {
            console.error('Supabase Upsert Failed:', error);
        } else {
            console.log('Success! Merchant record synced:', data);
        }

    } catch (error) {
        console.error('Script Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run for the specific ID
syncStoreToMerchant('9103ca71-523e-4e84-a664-3e40825f1be8');
