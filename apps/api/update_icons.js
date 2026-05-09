const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ICONS = {
    "Fresh Items": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-2FreshPicks-FreshVegetables.png",
    "Bakeries & Desserts": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-4Bakeries&Desserts-Cakes&Pastries.png",
    "Beauty & Personal Care": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-11Beauty&PersonalCare-Men_sGrooming.png",
    "Electrical, Paints and Automobiles": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-13Electricals,Paints&Automotive.png",
    "Electronics & Accessories": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-7Electronics&Accessories.png",
    "Fashion & Apparel": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-8Fashion&Apparel-Accessories&Jewellery.png",
    "Hardware & Plumbing": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-14Hardware&Plumbing-Drills&Bits.png",
    "Home & Lifestyle": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-9Home&Lifestyle-BathroomAccessories.png",
    "Stationary, Gifting and Toys": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-12Stationery,Gifting&Toys-Art&CraftSupplies.png",
    "Pooja & Festive Needs": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-15Pooja&Festive%20Needs-Agarbatti&Dhoop.png",
    "Restaurants & Cafes": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-3Restaurants&Cafes.png",
    "Sports & Fitness": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-5Sports&Fitness-GymEquipment.png",
    "Pet Care & Supplies": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-10PetCare&Supplies.png",
    "Pharmacy & Wellness": "https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/app-assets/PAS_AppIcons-6Pharmacy&Wellness-FirstAid.png"
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
