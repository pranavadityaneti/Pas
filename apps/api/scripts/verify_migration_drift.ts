/**
 * Read-only verification: for each May/June migration that Prisma thinks is
 * pending, check whether its key DDL is actually present on prod. Reports
 * PASS / FAIL per migration. Mutates nothing.
 *
 * Run: cd apps/api && npx ts-node --transpile-only scripts/verify_migration_drift.ts
 */

import { PrismaClient } from '@prisma/client';

interface Check {
    migration: string;
    description: string;
    kind: 'table' | 'column' | 'enum-value' | 'index';
    schema?: string;
    table?: string;
    column?: string;
    enumType?: string;
    enumValue?: string;
    indexName?: string;
}

const CHECKS: Check[] = [
    // 20260528120000_add_recipient_role
    { migration: '20260528120000_add_recipient_role',
        description: 'notifications.recipient_role column',
        kind: 'column', schema: 'public', table: 'notifications', column: 'recipient_role' },

    // 20260529100000_admin_otp_allowlist
    { migration: '20260529100000_admin_otp_allowlist',
        description: 'admin_allowlist table',
        kind: 'table', schema: 'public', table: 'admin_allowlist' },
    { migration: '20260529100000_admin_otp_allowlist',
        description: 'User.isAdmin column',
        kind: 'column', schema: 'public', table: 'User', column: 'isAdmin' },

    // 20260530100000_coupon_engine
    { migration: '20260530100000_coupon_engine',
        description: 'coupons.min_order column',
        kind: 'column', schema: 'public', table: 'coupons', column: 'min_order' },
    { migration: '20260530100000_coupon_engine',
        description: 'coupons.bogo_buy column',
        kind: 'column', schema: 'public', table: 'coupons', column: 'bogo_buy' },
    { migration: '20260530100000_coupon_engine',
        description: 'coupon_redemptions table',
        kind: 'table', schema: 'public', table: 'coupon_redemptions' },
    { migration: '20260530100000_coupon_engine',
        description: 'DiscountType enum has BOGO value',
        kind: 'enum-value', enumType: 'DiscountType', enumValue: 'BOGO' },

    // 20260530120000_coupon_theme
    { migration: '20260530120000_coupon_theme',
        description: 'coupons.theme column',
        kind: 'column', schema: 'public', table: 'coupons', column: 'theme' },

    // 20260602230000_wati_inbox
    { migration: '20260602230000_wati_inbox',
        description: 'wati_inbox table',
        kind: 'table', schema: 'public', table: 'wati_inbox' },
    { migration: '20260602230000_wati_inbox',
        description: 'wati_inbox_wa_phone_idx index',
        kind: 'index', schema: 'public', indexName: 'wati_inbox_wa_phone_idx' },

    // 20260602230100_rbac_roles
    { migration: '20260602230100_rbac_roles',
        description: 'Role enum has OPERATIONS value',
        kind: 'enum-value', enumType: 'Role', enumValue: 'OPERATIONS' },
    { migration: '20260602230100_rbac_roles',
        description: 'Role enum has FINANCE value',
        kind: 'enum-value', enumType: 'Role', enumValue: 'FINANCE' },
    { migration: '20260602230100_rbac_roles',
        description: 'Role enum has SUPPORT value',
        kind: 'enum-value', enumType: 'Role', enumValue: 'SUPPORT' },

    // 20260602230200_user_status_suspend
    { migration: '20260602230200_user_status_suspend',
        description: 'User.status column',
        kind: 'column', schema: 'public', table: 'User', column: 'status' },
    { migration: '20260602230200_user_status_suspend',
        description: 'User.suspended_at column',
        kind: 'column', schema: 'public', table: 'User', column: 'suspended_at' },
    { migration: '20260602230200_user_status_suspend',
        description: 'User.suspended_reason column',
        kind: 'column', schema: 'public', table: 'User', column: 'suspended_reason' },

    // 20260603160000_admin_allowlist_role
    { migration: '20260603160000_admin_allowlist_role',
        description: 'admin_allowlist.role column',
        kind: 'column', schema: 'public', table: 'admin_allowlist', column: 'role' },
];

async function checkOne(prisma: PrismaClient, c: Check): Promise<boolean> {
    if (c.kind === 'table') {
        const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = ${c.schema} AND table_name = ${c.table}
            ) AS exists;
        `;
        return rows[0]?.exists === true;
    }
    if (c.kind === 'column') {
        const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = ${c.schema} AND table_name = ${c.table} AND column_name = ${c.column}
            ) AS exists;
        `;
        return rows[0]?.exists === true;
    }
    if (c.kind === 'enum-value') {
        const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
            SELECT EXISTS (
                SELECT 1 FROM pg_type t
                JOIN pg_enum e ON e.enumtypid = t.oid
                WHERE t.typname = ${c.enumType} AND e.enumlabel = ${c.enumValue}
            ) AS exists;
        `;
        return rows[0]?.exists === true;
    }
    if (c.kind === 'index') {
        const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
            SELECT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE schemaname = ${c.schema} AND indexname = ${c.indexName}
            ) AS exists;
        `;
        return rows[0]?.exists === true;
    }
    return false;
}

async function main() {
    const prisma = new PrismaClient();
    try {
        console.log('Verifying migration drift — checking if each pending migration is ALREADY applied to prod (read-only).\n');

        const byMigration = new Map<string, { description: string; ok: boolean }[]>();
        for (const c of CHECKS) {
            const ok = await checkOne(prisma, c);
            if (!byMigration.has(c.migration)) byMigration.set(c.migration, []);
            byMigration.get(c.migration)!.push({ description: c.description, ok });
        }

        const fullyApplied: string[] = [];
        const partiallyApplied: string[] = [];
        const notApplied: string[] = [];

        for (const [migration, checks] of byMigration) {
            const allOk = checks.every(c => c.ok);
            const someOk = checks.some(c => c.ok);
            const label = allOk ? '✅ FULLY APPLIED' : someOk ? '⚠️  PARTIAL' : '❌ NOT APPLIED';
            console.log(`${label}  ${migration}`);
            for (const c of checks) {
                console.log(`   ${c.ok ? '✓' : '✗'}  ${c.description}`);
            }
            console.log('');
            if (allOk) fullyApplied.push(migration);
            else if (someOk) partiallyApplied.push(migration);
            else notApplied.push(migration);
        }

        console.log('---');
        console.log(`Fully applied (safe to migrate resolve --applied): ${fullyApplied.length}`);
        for (const m of fullyApplied) console.log(`  ${m}`);
        if (partiallyApplied.length > 0) {
            console.log(`\nPartially applied (DANGER — manual investigation needed): ${partiallyApplied.length}`);
            for (const m of partiallyApplied) console.log(`  ${m}`);
        }
        if (notApplied.length > 0) {
            console.log(`\nNot applied (need to RUN the SQL, not just mark as applied): ${notApplied.length}`);
            for (const m of notApplied) console.log(`  ${m}`);
        }

        if (partiallyApplied.length === 0 && notApplied.length === 0) {
            console.log('\n✅ All 8 May/June migrations are FULLY applied. Safe to run prisma migrate resolve --applied for each.');
            process.exit(0);
        } else {
            console.log('\n⚠️  Drift detected. Do NOT mass-mark — investigate the partial/not-applied ones first.');
            process.exit(2);
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(e => { console.error('Script failed:', e?.message || e); process.exit(1); });
