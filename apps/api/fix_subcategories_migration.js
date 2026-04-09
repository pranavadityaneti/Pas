const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MAPPINGS = [
  // --- Grocery & Kirana ---
  { id: "d463cd2c-4a2a-4dae-885d-0466ef527261", keywords: ["Atta", "Flour", "Chakki"] },
  { id: "0193fee4-2b7f-4ca3-ad9d-7bfc1b0a17b0", keywords: ["Rice", "Basmati", "Poha", "Grains"] },
  { id: "66e8a5e6-b68d-4993-a85b-b310c1ec61ab", keywords: ["Turmeric", "Masala", "Haldi", "Powder", "Spices", "Chilli", "Coriander", "Cumin"] },
  { id: "1d9e53e6-2411-4030-a60d-1bfeca7eeed7", keywords: ["Oil", "Ghee", "Sunflower", "Mustard"] },
  { id: "cb0b4cb0-75e3-4ca9-bc7b-0c2955168b61", keywords: ["Dal", "Moong", "Toor", "Urad", "Chana", "Pulses", "Lentils"] },

  // --- Pharmacy & Wellness ---
  { id: "8ff8148e-65d0-4c40-804f-8e5ce50b475d", keywords: ["Vitamin", "Supplement", "Calcium", "Zinc", "Multivitamin", "Revital", "Protein"] },
  { id: "ffcd92e1-0880-45cb-a70d-ddafa819cb5a", keywords: ["Pain", "Relief", "Vaporub", "Moov", "Iodex", "Axe", "Spray", "Balm", "Volini"] },
  { id: "4cc9c41b-ce61-48ad-b99f-6fb9f544cad5", keywords: ["Handwash", "Soap", "Sanitizer", "Dettol", "Lifebuoy", "Himalaya", "Pears", "Hygiene"] },
  { id: "77b1991b-089e-4c57-8fc5-3eb62cf8b0a7", keywords: ["Bandage", "Dressing", "Cotton", "Antiseptic", "Savlon", "Betadine", "Dettol Antiseptic"] },
  { id: "8296c854-f3dc-4d4b-a578-0d5edb6e576a", keywords: ["Pudina", "Eno", "Gas", "Gelusil", "Antacid", "Digene", "Stomach"] },
  { id: "598abe60-e338-4a34-9c28-c4aa25eca8e4", keywords: ["Ayurvedic", "Herbal", "Churanam", "Dabur", "Baidyanath", "Tulsi", "Ashwagandha"] },
  { id: "53a13768-f485-4d11-8b97-9cbc9071eba9", keywords: ["Baby", "Diaper", "Pampers", "Johnson", "MamyPoko", "Cerelac"] },
  { id: "8edfd5a9-3c21-4c16-bda3-6e325faee948", keywords: ["Paracetamol", "Crocin", "Calpol", "Cough", "Cold", "Syrup", "Tablet"] }
];

async function run() {
    try {
        console.log('Starting keyword-based subcategory migration...');
        let totalUpdated = 0;

        for (const mapping of MAPPINGS) {
            const pattern = `%${mapping.keywords.join('%|%')}%`; // Simplified logic
            
            // Build a manual query to update products whose names contain any of the keywords
            for (const keyword of mapping.keywords) {
                const result = await prisma.$executeRawUnsafe(
                    `UPDATE "Product" 
                     SET category_id = ${mapping.id === null ? 'NULL' : `'${mapping.id}'`}::uuid 
                     WHERE (name ILIKE $1 OR description ILIKE $1) 
                     AND category_id IS NULL`, 
                    `%${keyword}%`
                );
                totalUpdated += Number(result);
            }
        }

        console.log(`Migration complete! Successfully linked ${totalUpdated} products to subcategories.`);
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
