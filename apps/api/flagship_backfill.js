const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('[DRY RUN] Starting Flagship Branch Backfill Analysis...');

    // 1. Fetch all ACTIVE merchants
    const activeMerchants = await prisma.merchant.findMany({
      where: {
        status: 'active'
      },
      include: {
        branches: true // Fetch associated branches
      }
    });

    const merchantsWithoutBranches = activeMerchants.filter(
      (m) => !m.branches.some(b => b.id === m.id)
    );

    console.log(`Found ${merchantsWithoutBranches.length} active merchants missing their Flagship Branch.`);

    const rescuePayloads = [];

    for (const merchant of merchantsWithoutBranches) {
      // Look up legacy store table just in case they have coords or city there
      const store = await prisma.store.findUnique({
        where: { id: merchant.id }
      });

      const rescueBranch = {
        id: merchant.id, // CRITICAL: Forced key mapping for inventory backward-compat
        merchantId: merchant.id,
        branchName: merchant.storeName || store?.name || 'Unnamed Flagship',
        managerName: merchant.ownerName,
        address: merchant.address || store?.address || null,
        city: merchant.city || store?.cityId || null, // Assuming store.cityId might be the readable city if schema shifted
        latitude: merchant.latitude || store?.latitude || null,
        longitude: merchant.longitude || store?.longitude || null,
        phone: merchant.phone || null,
        isActive: true
      };

      rescuePayloads.push(rescueBranch);
    }

    console.log('\n--- TARGET RESCUE JSON ---');
    console.log(JSON.stringify(rescuePayloads, null, 2));
    console.log('--------------------------');
    console.log('EXECUTING LIVE INSERTION...');

    // Use a transaction for safe insertion or looped upsert
    let count = 0;
    for (const payload of rescuePayloads) {
      await prisma.merchantBranch.upsert({
        where: { id: payload.id },
        update: payload,
        create: payload
      });
      count++;
    }

    console.log(`[SUCCESS] BACKFILL COMPLETE: ${count} rows successfully written to merchant_branches.`);

  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
