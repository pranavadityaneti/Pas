const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        // Compact summary
        console.log('=== VERTICALS ===');
        const verticals = await prisma.$queryRaw`
            SELECT id, name FROM "Vertical" WHERE name IN ('Grocery & Kirana', 'Pharmacy & Wellness') ORDER BY name;
        `;
        verticals.forEach(v => console.log(`  ${v.name} → ${v.id}`));

        console.log('\n=== SUBCATEGORIES ===');
        const subcats = await prisma.$queryRaw`
            SELECT t2.id, t2.name, v.name as vertical_name,
                   (SELECT COUNT(*) FROM "Product" p WHERE p.category_id = t2.id) as product_count
            FROM "Tier2Category" t2
            JOIN "Vertical" v ON t2.vertical_id = v.id
            WHERE v.name IN ('Grocery & Kirana', 'Pharmacy & Wellness')
            AND t2.active = true
            ORDER BY v.name, t2.name;
        `;
        subcats.forEach(s => console.log(`  [${s.vertical_name}] ${s.name} → ${s.product_count} products linked`));

        console.log('\n=== PRODUCT category_id SUMMARY ===');
        const coverage = await prisma.$queryRaw`
            SELECT v.name, COUNT(*) as total, COUNT(category_id) as has_cat_id
            FROM "Product" p JOIN "Vertical" v ON p.vertical_id = v.id
            WHERE v.name IN ('Grocery & Kirana', 'Pharmacy & Wellness')
            GROUP BY v.name;
        `;
        coverage.forEach(c => console.log(`  ${c.name}: ${c.total} products, ${c.has_cat_id} have category_id (${((Number(c.has_cat_id)/Number(c.total))*100).toFixed(0)}%)`));

        // Check if products have the text subcategory field instead
        console.log('\n=== DISTINCT subcategory TEXT VALUES ===');
        const textVals = await prisma.$queryRaw`
            SELECT DISTINCT p.subcategory, v.name as vertical
            FROM "Product" p
            JOIN "Vertical" v ON p.vertical_id = v.id
            WHERE v.name IN ('Grocery & Kirana', 'Pharmacy & Wellness')
            AND p.subcategory IS NOT NULL
            ORDER BY v.name, p.subcategory
            LIMIT 30;
        `;
        if (textVals.length === 0) {
            console.log('  (none — both subcategory text AND category_id UUID are empty)');
        } else {
            textVals.forEach(t => console.log(`  [${t.vertical}] "${t.subcategory}"`));
        }

        // Check catalog_name for grouping clues
        console.log('\n=== DISTINCT catalog_name VALUES ===');
        const catalogs = await prisma.$queryRaw`
            SELECT DISTINCT p.catalog_name, v.name as vertical, COUNT(*) as cnt
            FROM "Product" p
            JOIN "Vertical" v ON p.vertical_id = v.id
            WHERE v.name IN ('Grocery & Kirana', 'Pharmacy & Wellness')
            AND p.catalog_name IS NOT NULL
            GROUP BY p.catalog_name, v.name
            ORDER BY v.name, cnt DESC
            LIMIT 30;
        `;
        if (catalogs.length === 0) {
            console.log('  (none)');
        } else {
            catalogs.forEach(c => console.log(`  [${c.vertical}] "${c.catalog_name}" (${c.cnt} products)`));
        }

    } catch (error) {
        console.error('Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
