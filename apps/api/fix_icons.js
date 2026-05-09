const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ICONS = {
    "Electricals, Paints & Automotive": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-13Electricals,Paints&Automotive.png",
    "Stationery, Gifting & Toys": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-12Stationery,Gifting&Toys-Art&CraftSupplies.png"
};

async function main() {
    console.log("Starting icon update...");
    for (const [name, iconUrl] of Object.entries(ICONS)) {
        try {
            const result = await prisma.vertical.updateMany({
                where: { name: name },
                data: { icon: iconUrl }
            });
            console.log(`Updated ${name}: matched ${result.count} rows`);
        } catch (e) {
            console.error(`Failed to update ${name}:`, e.message);
        }
    }
    console.log("Done updating icons.");
}

main().finally(() => prisma.$disconnect());
