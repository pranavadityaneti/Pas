
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'apps/api/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);
const prisma = new PrismaClient();

async function verifySync() {
    const storeId = '9103ca71-523e-4e84-a664-3e40825f1be8';

    // 1. Get current name
    const storeBefore = await prisma.store.findUnique({ where: { id: storeId } });
    console.log('Current Store Name in App:', storeBefore?.name);

    const testName = 'Jon Kirana - Admin Sync Test';
    console.log(`\nSimulating Admin Update: Changing name to "${testName}" in merchants table...`);

    // 2. Update via Supabase (Simulate Admin Dashboard)
    const { error: updateError } = await supabase
        .from('merchants')
        .update({ store_name: testName, updated_at: new Date().toISOString() })
        .eq('id', storeId);

    if (updateError) {
        console.error('Update Failed:', updateError);
        return;
    }

    // Wait a brief moment for trigger to fire
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Verify in Prisma
    const storeAfter = await prisma.store.findUnique({ where: { id: storeId } });
    console.log('New Store Name in App after Trigger:', storeAfter?.name);

    if (storeAfter?.name === testName) {
        console.log('\n✅ SUCCESS: Admin -> App sync working!');
    } else {
        console.log('\n❌ FAILURE: Admin -> App sync failed.');
    }

    // Cleanup: Set it back to Jon Kirana
    console.log('\nCleaning up: Setting name back to "Jon Kirana"...');
    await supabase.from('merchants').update({ store_name: 'Jon Kirana' }).eq('id', storeId);

    await prisma.$disconnect();
}

verifySync();
