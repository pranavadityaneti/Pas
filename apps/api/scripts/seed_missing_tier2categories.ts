/**
 * One-time script: Seed missing Tier2Category rows so the Apify scraper's
 * mapCategory() output and the admin dashboard PRODUCT_CATEGORIES dropdowns
 * resolve to valid UUIDs.
 *
 * Safe to run multiple times — uses upsert on the (vertical_id, name) unique constraint.
 *
 * Run from apps/api/:
 *   npx ts-node scripts/seed_missing_tier2categories.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Categories to ensure exist, grouped by their parent Vertical name.
// These match the strings returned by mapCategory() in processScraperDataset()
// AND the PRODUCT_CATEGORIES array in the admin MasterCatalog.tsx.
const REQUIRED_CATEGORIES: Record<string, string[]> = {
    'Grocery & Kirana': [
        'Dairy & Milk',       // mapCategory: dairy/milk/paneer/cheese/egg
        'Staples & Pulse',    // mapCategory: staple/rice/dal/flour/atta/masala
        'Snacks & Munchies',  // already exists (seeded by relational_migration)
        'Beverages',          // already exists (seeded by relational_migration)
        'General',            // mapCategory: fallback for unmatched grocery items
        'Ready-to-Eat',       // admin PRODUCT_CATEGORIES dropdown
        'Household Supply',   // admin PRODUCT_CATEGORIES dropdown
    ],
    'Fresh Items': [
        'Fresh Produce',      // mapCategory: fruit/veg/produce
    ],
    'Pharmacy & Wellness': [
        'Personal Care',      // mapCategory: pharmacy/wellness/personal care/hygiene/skin/hair
    ],
    'Home & Lifestyle': [
        'Home Essentials',    // mapCategory: home/lifestyle/cleaning/detergent/household
    ],
};

async function main() {
    console.log('Seeding missing Tier2Category rows...\n');

    // Fetch all verticals
    const verticals = await (prisma as any).vertical.findMany({
        select: { id: true, name: true },
    });
    const verticalMap = new Map<string, string>(
        verticals.map((v: any) => [v.name, v.id])
    );

    let created = 0;
    let skipped = 0;

    for (const [verticalName, categories] of Object.entries(REQUIRED_CATEGORIES)) {
        const verticalId = verticalMap.get(verticalName);
        if (!verticalId) {
            console.error(`  ✗ Vertical "${verticalName}" not found in DB — skipping its categories`);
            continue;
        }

        for (const catName of categories) {
            try {
                await (prisma as any).tier2Category.upsert({
                    where: {
                        verticalId_name: { verticalId: verticalId, name: catName },
                    },
                    update: {},  // no-op if already exists
                    create: {
                        name: catName,
                        verticalId: verticalId,
                    },
                });

                // Check if it was a create or a no-op update
                const existing = await (prisma as any).tier2Category.findUnique({
                    where: {
                        verticalId_name: { verticalId: verticalId, name: catName },
                    },
                    select: { id: true, createdAt: true, updatedAt: true },
                });

                // If createdAt == updatedAt (within 1s), it was freshly created
                const isNew = Math.abs(existing.createdAt.getTime() - existing.updatedAt.getTime()) < 1000;
                if (isNew) {
                    console.log(`  ✓ Created: "${catName}" under "${verticalName}" [${existing.id}]`);
                    created++;
                } else {
                    console.log(`  · Already exists: "${catName}" under "${verticalName}"`);
                    skipped++;
                }
            } catch (err: any) {
                console.error(`  ✗ Failed to upsert "${catName}" under "${verticalName}":`, err.message);
            }
        }
    }

    console.log(`\nDone. Created: ${created}, Already existed: ${skipped}`);
}

main()
    .catch((e) => {
        console.error('Script failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
