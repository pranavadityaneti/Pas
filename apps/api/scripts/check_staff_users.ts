/**
 * Read-only prod-Supabase sanity check (authorized by Pranav 2026-06-09).
 * Counts the populations that finding #2 of the adversarial review hinges on:
 *  - store_staff rows           → non-owner staff who log into the merchant app
 *  - merchant_branches.phone    → phone-matched branch managers
 *  - Total merchant_branches + MERCHANT-role users for denominators
 *
 * If both populations are 0, finding #2 is dormant on prod even after the
 * merchant-app OTA ships commit 2. If either is non-zero, finding #2 is a
 * pre-OTA hot-fix gate.
 *
 * Run: cd apps/api && npx ts-node --transpile-only scripts/check_staff_users.ts
 */
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const staffCount = await prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*)::bigint AS count FROM store_staff
        `;
        const branchPhoneCount = await prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*)::bigint AS count FROM merchant_branches
            WHERE phone IS NOT NULL AND phone != ''
        `;
        const merchantCount = await prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*)::bigint AS count FROM "User" WHERE role = 'MERCHANT'
        `;
        const branchCount = await prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*)::bigint AS count FROM merchant_branches
        `;

        const staff = Number(staffCount[0]?.count ?? 0);
        const branchPhone = Number(branchPhoneCount[0]?.count ?? 0);
        const merchants = Number(merchantCount[0]?.count ?? 0);
        const branches = Number(branchCount[0]?.count ?? 0);

        console.log('store_staff rows (non-owner staff):                 ', staff);
        console.log('merchant_branches with phone set (phone-managers):  ', branchPhone);
        console.log('Total merchant_branches:                            ', branches);
        console.log('Total MERCHANT-role users:                          ', merchants);
        console.log('');
        if (staff === 0 && branchPhone === 0) {
            console.log('✅ Finding #2 is DORMANT on prod — no non-owner merchant users exist.');
            console.log('   Pre-OTA gate downgraded to: fix before staff feature ships, not before OTA.');
        } else {
            console.log('⚠️  Finding #2 is a LIVE pre-OTA gate:');
            if (staff > 0) console.log(`   - ${staff} store_staff row(s) → these users will 403 once merchant-app OTAs commit 2`);
            if (branchPhone > 0) console.log(`   - ${branchPhone} branch(es) with phone-manager login → these will 403 once merchant-app OTAs commit 2`);
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => { console.error('Script failed:', e?.message || e); process.exit(1); });
