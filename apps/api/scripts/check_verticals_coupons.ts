/**
 * Read-only operational check (authorized by Pranav 2026-06-10).
 * Phase 5B's server-derived store-id fix means verticals-scoped coupons start
 * WORKING the moment the API deployed (they were silently broken before —
 * client sent branch UUIDs that never matched prisma.store rows, so every
 * verticals-scoped coupon was rejected at validation).
 *
 * Lists every non-archived coupon with a non-empty eligible_verticals array,
 * resolves vertical ids to names, and shows budget-relevant fields so Pranav
 * can decide if any should be deactivated before customers can redeem them.
 *
 * Run: cd apps/api && npx ts-node --transpile-only scripts/check_verticals_coupons.ts
 */
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const coupons = await prisma.$queryRaw<any[]>`
            SELECT id, code, description, is_active, deleted_at, funding_source,
                   discount_type, discount_value, max_discount_cap, min_order,
                   usage_limit, used_count, daily_usage_limit, daily_usage_count,
                   per_customer_limit, eligible_verticals, eligible_order_types,
                   start_date, end_date, store_id
            FROM coupons
            WHERE array_length(eligible_verticals, 1) > 0
            ORDER BY is_active DESC, created_at DESC;
        `;
        if (coupons.length === 0) {
            console.log('✅ NO verticals-scoped coupons exist (active or archived). Nothing goes live unintentionally.');
            return;
        }
        // Resolve vertical names
        const allVids = Array.from(new Set(coupons.flatMap((c) => c.eligible_verticals || [])));
        const verticals = await prisma.$queryRaw<any[]>`
            SELECT id::text AS id, name FROM "Vertical" WHERE id::text = ANY(${allVids}::text[]);
        `;
        const vname = new Map(verticals.map((v) => [v.id, v.name]));

        console.log(`Found ${coupons.length} verticals-scoped coupon(s):\n`);
        for (const c of coupons) {
            const status = c.deleted_at ? 'ARCHIVED' : (c.is_active ? '🟢 ACTIVE' : '⚪ INACTIVE');
            const vnames = (c.eligible_verticals || []).map((v: string) => vname.get(v) || `<unknown:${v}>`).join(', ');
            const now = new Date();
            const inWindow = (!c.start_date || new Date(c.start_date) <= now) && (!c.end_date || new Date(c.end_date) >= now);
            console.log(`[${status}] ${c.code} — ${c.description || '(no description)'}`);
            console.log(`   Verticals: ${vnames}`);
            console.log(`   Discount: ${c.discount_type} ${c.discount_value}${c.max_discount_cap ? ` (cap ₹${c.max_discount_cap})` : ''} | Funding: ${c.funding_source || '(unset)'}`);
            console.log(`   Limits: usage ${c.used_count}/${c.usage_limit ?? '∞'} | daily ${c.daily_usage_count ?? 0}/${c.daily_usage_limit ?? '∞'} | per-customer ${c.per_customer_limit ?? '∞'} | minOrder ₹${c.min_order ?? 0}`);
            console.log(`   Window: ${c.start_date ? new Date(c.start_date).toISOString().slice(0, 10) : '-'} → ${c.end_date ? new Date(c.end_date).toISOString().slice(0, 10) : 'no end'} ${inWindow ? '(IN WINDOW NOW)' : '(out of window)'}`);
            console.log(`   ⚠️  REDEEMABLE TODAY: ${!c.deleted_at && c.is_active && inWindow ? 'YES — was broken before the Phase 5 deploy, now functional' : 'no'}`);
            console.log('');
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => { console.error('Script failed:', e?.message || e); process.exit(1); });
