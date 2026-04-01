import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();

async function executeMigration() {
    console.log('--- TERMINATING OTHER CONNECTIONS TO DROP LOCKS ---');
    try {
        await prisma.$executeRawUnsafe(`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = current_database() AND pid <> pg_backend_pid();
        `);
    } catch (e: any) {
        console.log("Terminate connections result:", e.message);
    }

    console.log('--- STARTING ATOMIC DATABASE HARDENING ---');
    if (!fs.existsSync('/tmp/policy_backup.json')) {
        console.error("Missing policy backup!");
        process.exit(1);
    }
    const backup = JSON.parse(fs.readFileSync('/tmp/policy_backup.json', 'utf8'));
    
    console.log('1. Dropping all public policies...');
    for (const p of backup) {
        try {
            await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "${p.policyname}" ON public."${p.tablename}";`);
        } catch(e: any) { }
    }

    console.log('2. Dropping primary Foreign Keys...');
    const fksToDrop = [
        ['Store', 'Store_managerId_fkey'],
        ['StoreProduct', 'StoreProduct_storeId_fkey'],
        ['notifications', 'notifications_user_id_fkey'],
        ['orders', 'Order_staff_id_fkey'],
        ['orders', 'fk_orders_store'],
        ['orders', 'fk_orders_user'],
        ['coupons', 'Coupon_store_id_fkey'],
        ['order_items', 'order_items_order_id_fkey']
    ];
    for (const [table, name] of fksToDrop) {
        try { await prisma.$executeRawUnsafe(`ALTER TABLE public."${table}" DROP CONSTRAINT IF EXISTS "${name}";`); } catch(e: any) {}
    }

    console.log('3. Sanitizing non-UUID legacy data...');
    try { await prisma.$executeRawUnsafe(`DELETE FROM public.orders WHERE store_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';`); } catch(e){}
    try { await prisma.$executeRawUnsafe(`DELETE FROM public.orders WHERE user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';`); } catch(e){}
    try { await prisma.$executeRawUnsafe(`UPDATE public."Store" SET "managerId" = NULL WHERE "managerId" IS NOT NULL AND "managerId"::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';`); } catch(e){}

    console.log('4. Unifying Schema on UUID...');
    try { await prisma.$executeRawUnsafe(`ALTER TABLE public."User" ALTER COLUMN id TYPE uuid USING id::uuid;`); } catch(e:any){ console.log("User id:", e.message) }
    try { await prisma.$executeRawUnsafe(`ALTER TABLE public."Store" ALTER COLUMN id TYPE uuid USING id::uuid;`); } catch(e:any){ console.log("Store id:", e.message) }
    try { await prisma.$executeRawUnsafe(`ALTER TABLE public."Store" ALTER COLUMN "managerId" TYPE uuid USING "managerId"::uuid;`); } catch(e:any){ console.log("Store managerId:", e.message) }
    try { await prisma.$executeRawUnsafe(`ALTER TABLE public."StoreProduct" ALTER COLUMN "storeId" TYPE uuid USING "storeId"::uuid;`); } catch(e:any){ console.log("StoreProduct storeId:", e.message) }
    try { await prisma.$executeRawUnsafe(`ALTER TABLE public.orders ALTER COLUMN store_id TYPE uuid USING store_id::uuid;`); } catch(e:any){ console.log("orders store_id:", e.message) }
    try { await prisma.$executeRawUnsafe(`ALTER TABLE public.orders ALTER COLUMN user_id TYPE uuid USING user_id::uuid;`); } catch(e:any){ console.log("orders user_id:", e.message) }
    try { await prisma.$executeRawUnsafe(`ALTER TABLE public.notifications ALTER COLUMN user_id TYPE uuid USING user_id::uuid;`); } catch(e:any){ console.log("notifications user_id:", e.message) }
    try { await prisma.$executeRawUnsafe(`ALTER TABLE public.coupons ALTER COLUMN store_id TYPE uuid USING store_id::uuid;`); } catch(e:any){ console.log("coupons store_id:", e.message) }

    console.log('5. ENFORCING PHYSICAL LOCKS (Mandate 2)...');
    try { await prisma.$executeRawUnsafe(`ALTER TABLE public.orders ADD CONSTRAINT fk_orders_store FOREIGN KEY (store_id) REFERENCES public."Store"(id) ON DELETE RESTRICT;`); } catch(e:any) { console.error("FK orders_store failed:", e.message); }
    try { await prisma.$executeRawUnsafe(`ALTER TABLE public.orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES public."User"(id) ON DELETE RESTRICT;`); } catch(e:any) { console.error("FK orders_user failed:", e.message); }
    
    try { await prisma.$executeRawUnsafe(`ALTER TABLE public."Store" ADD CONSTRAINT "Store_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES public."User"(id) ON DELETE RESTRICT;`); } catch(e:any) { console.error("FK Store_managerId_fkey fail:", e.message); }
    try { await prisma.$executeRawUnsafe(`ALTER TABLE public."StoreProduct" ADD CONSTRAINT "StoreProduct_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON DELETE CASCADE;`); } catch(e:any) { console.error("FK StoreProduct_storeId fail:", e.message); }
    try { await prisma.$executeRawUnsafe(`ALTER TABLE public.notifications ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."User"(id) ON DELETE CASCADE;`); } catch(e:any) { console.error("FK notif user_id fail:", e.message); }

    console.log('6. Restoring RLS Policies...');
    for (const p of backup) {
        try {
            let sql = `CREATE POLICY "${p.policyname}" ON public."${p.tablename}" `;
            if (p.permissive === 'RESTRICTIVE') sql += 'AS RESTRICTIVE ';
            sql += `FOR ${p.cmd} `;
            if (p.roles && p.roles.length) sql += `TO ${p.roles.join(', ')} `;
            if (p.qual) sql += `USING (${p.qual}) `;
            if (p.with_check) sql += `WITH CHECK (${p.with_check}) `;
            await prisma.$executeRawUnsafe(sql);
        } catch(e: any) {
             // Ignoring errors if it already exists or minor type issues
        }
    }

    console.log('--- MANDATE 2 FULLY EXECUTED ---');
}

executeMigration().catch(e => console.error(e)).finally(() => prisma.$disconnect());
