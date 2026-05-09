const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function normalizeVerticals() {
    console.log("Starting Vertical normalization...");
    const verticals = await prisma.vertical.findMany({ select: { id: true, name: true } });

    // 1. Group by lowercased name
    const groups = {};
    for (const v of verticals) {
        const lower = v.name.toLowerCase().replace(/ and /g, ' & ');
        if (!groups[lower]) groups[lower] = [];
        groups[lower].push(v);
    }

    // 2. Resolve duplicates
    for (const [key, group] of Object.entries(groups)) {
        if (group.length > 1) {
            console.log(`Found duplicate group for: ${key}`);
            
            // Prefer the one that contains an ampersand or starts with uppercase as primary
            let primary = group.find(v => v.name.includes('&'));
            if (!primary) primary = group.find(v => v.name[0] === v.name[0].toUpperCase());
            if (!primary) primary = group[0]; // fallback

            const duplicates = group.filter(v => v.id !== primary.id);

            for (const dup of duplicates) {
                console.log(`  - Migrating items from "${dup.name}" (${dup.id}) to "${primary.name}" (${primary.id})`);
                
                // We need to check dependent tables. Let's find tables that reference Vertical.id
                // Primary is Product which has category? No, Product might have `vertical_id` 
                // Wait, from catalog-picker.tsx we see `p.vertical_id`. Let's check Product table
                // Let's just use raw SQL to find and update since Prisma might complain if we miss relations.
                
                try {
                    await prisma.$executeRawUnsafe(`UPDATE "Product" SET vertical_id = $1 WHERE vertical_id = $2`, primary.id, dup.id);
                    console.log(`    - Migrated Product references`);
                } catch (e) {
                    // Ignore if missing column
                    console.log("    - No Product vertical_id column to update or error:", e.message);
                }
                
                try {
                    await prisma.vertical.delete({ where: { id: dup.id } });
                    console.log(`    - Deleted duplicate vertical: ${dup.name}`);
                } catch (e) {
                    console.log(`    - Failed to delete duplicated vertical (might be locked/referenced):`, e.message);
                }
            }
        }
    }
    
    // Quick fix for "Fresh items" -> "Fresh Items"
    await prisma.$executeRawUnsafe(`UPDATE "Vertical" SET name = 'Fresh Items' WHERE name = 'Fresh items'`);
    
    console.log("Normalization complete!");
}

normalizeVerticals().catch(console.error).finally(() => prisma.$disconnect());
