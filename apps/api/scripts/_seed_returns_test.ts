// Seed a self-contained TEST order + a pending return & exchange so the admin
// Returns & Exchanges queue (GET /admin/issues) has rows to act on.
// Safe: throwaway test customer (no push token), test order has NO real Razorpay
// payment id → approving the return issues a SIMULATED refund (no real money).
// Fully removable (see ids printed at the end). Run: npx tsx scripts/_seed_returns_test.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// "Clean cuts" — a real store, used only as a valid FK target for the test order.
const STORE_ID = '71fa7b7c-d5a2-4f42-8e4b-61383da57c54';
const BRANCH_ID = '71fa7b7c-d5a2-4f42-8e4b-61383da57c54';

async function main() {
  const ts = Date.now();

  const user = await prisma.user.create({
    data: {
      email: `returns-test-${ts}@test.pickatstore.app`,
      name: 'Test Customer (Returns Test)',
      role: 'CONSUMER',
      phone: '9000000000',
    },
  });
  console.log('test user   :', user.id);

  const order = await prisma.order.create({
    data: {
      orderNumber: `TEST-RET-${ts}`,
      storeId: STORE_ID,
      branchId: BRANCH_ID,
      userId: user.id,
      totalAmount: 500,
      status: 'COMPLETED',
      isPaid: true,
      customer_name: 'Test Customer',
      customer_phone: '9000000000',
      store_name: 'Clean cuts (TEST)',
      order_type: 'pickup',
      metadata: { test: true, seededFor: 'returns-exchanges-admin-test' },
    },
  });
  console.log('test order  :', order.id, order.orderNumber);

  const slaDueAt = new Date(Date.now() + 24 * 3600 * 1000); // +24h (cron won't auto-approve before then)

  const ret = await prisma.orderIssue.create({
    data: {
      orderId: order.id,
      type: 'return',
      reason: 'Item damaged on arrival (TEST)',
      description: 'Seeded test RETURN for the admin Returns & Exchanges queue. Approving issues a SIMULATED refund (the test order has no real Razorpay payment id), so no money moves.',
      status: 'PENDING',
      refundAmountInr: 500,
      photos: [],
      slaDueAt,
    },
  });
  console.log('RETURN issue:', ret.id, '(refund ₹500 — simulated on approve)');

  const exc = await prisma.orderIssue.create({
    data: {
      orderId: order.id,
      type: 'exchange',
      reason: 'Wrong size (TEST)',
      description: 'Seeded test EXCHANGE for the admin Returns & Exchanges queue. No refund on approve.',
      status: 'PENDING',
      photos: [],
      slaDueAt,
    },
  });
  console.log('EXCHANGE iss:', exc.id, '(no refund)');

  console.log('\n✅ Seeded. Refresh the admin Returns & Exchanges tab — 2 pending rows should appear.');
  console.log('🧹 To remove after testing (cascades the issues):');
  console.log(`   DELETE FROM orders WHERE id = '${order.id}';   -- then:`);
  console.log(`   DELETE FROM "User" WHERE id = '${user.id}';`);
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
