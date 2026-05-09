const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    const verticals = await prisma.vertical.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
    console.log(`Total verticals: ${verticals.length}`);
    verticals.forEach(v => console.log(`  - ${v.name}`));
    
    // Check for duplicates
    const names = verticals.map(v => v.name.toLowerCase().replace(/ and /g, ' & '));
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    console.log(dupes.length > 0 ? `\n⚠️ Duplicates still exist: ${dupes}` : '\n✅ No duplicates found!');
}

verify().catch(console.error).finally(() => prisma.$disconnect());
