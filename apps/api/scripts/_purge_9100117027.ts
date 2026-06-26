// Gated purge of the 9100117027 footprint so the number can be reused for a fresh
// signup test. DRY-RUN by default; --apply deletes (writes a rollback snapshot first).
// Run: npx tsx scripts/_purge_9100117027.ts            (dry-run)
//      npx tsx scripts/_purge_9100117027.ts --apply     (execute)
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply') || process.env.APPLY === '1';

const IDS = [
  '7c575305-e815-46a1-8844-662535227fd5', // Adi (has auth.users)
  '57f2aa5a-1210-42b6-ab3d-57ab6c396769', // Aditya
  '489139c6-4729-48a4-8e81-ca96dd86049f', // Jhonny
];
const PHONES = ['9100117027', '919100117027', '+919100117027'];
const idList = IDS.map(i => `'${i}'`).join(','); // trusted hardcoded UUIDs

const log = (...a: any[]) => console.log('[purge-9100117027]', ...a);
const tryStep = async (label: string, fn: () => Promise<number | string>) => {
  try { log(`  ${label}: ${await fn()}`); } catch (e: any) { log(`  ${label}: ERROR ${String(e.message).split('\n')[0]}`); }
};

async function main() {
  log(`mode = ${APPLY ? 'APPLY (will delete)' : 'DRY-RUN (read-only)'}`);

  const storeIds = (await prisma.store.findMany({ where: { managerId: { in: IDS } }, select: { id: true } })).map(s => s.id);
  const storeList = storeIds.map(i => `'${i}'`).join(',') || `'00000000-0000-0000-0000-000000000000'`;

  // ---- snapshot / counts ----
  const counts: Record<string, number> = {};
  counts.users = await prisma.user.count({ where: { id: { in: IDS } } });
  counts.stores = storeIds.length;
  counts.pushTokens = await prisma.merchantPushToken.count({ where: { userId: { in: IDS } } });
  counts.orderRequests = await prisma.order_requests.count({ where: { consumer_user_id: { in: IDS } } });
  counts.otps = await prisma.otpVerification.count({ where: { phone: { in: PHONES } } });
  for (const [label, sql] of [
    ['merchantConsents', `SELECT count(*)::int AS c FROM merchant_consents WHERE merchant_id IN (${idList})`],
    ['storeStaff', `SELECT count(*)::int AS c FROM store_staff WHERE store_id IN (${storeList}) OR auth_user_id IN (${idList}) OR user_id IN (${idList})`],
    ['favoriteStores', `SELECT count(*)::int AS c FROM favorite_stores WHERE user_id IN (${idList})`],
    ['profiles', `SELECT count(*)::int AS c FROM profiles WHERE id IN (${idList})`],
    ['authUsers', `SELECT count(*)::int AS c FROM auth.users WHERE id IN (${idList})`],
  ] as const) {
    try { const r = await prisma.$queryRawUnsafe<any[]>(sql); counts[label] = Number(r[0].c); }
    catch (e: any) { log(`  count ${label}: ERROR ${String(e.message).split('\n')[0]}`); counts[label] = -1; }
  }
  log('footprint:', JSON.stringify(counts));
  log('store ids:', storeIds.join(', ') || '(none)');

  if (!APPLY) { log('DRY-RUN complete — no changes. Re-run with --apply.'); return; }

  // ---- rollback snapshot BEFORE deleting ----
  const users = await prisma.user.findMany({ where: { id: { in: IDS } } });
  const reqs = await prisma.order_requests.findMany({ where: { consumer_user_id: { in: IDS } } });
  const stores = await prisma.store.findMany({ where: { managerId: { in: IDS } } });
  const profiles = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM profiles WHERE id IN (${idList})`);
  const authUsers = await prisma.$queryRawUnsafe<any[]>(`SELECT id, email, phone, created_at FROM auth.users WHERE id IN (${idList})`);
  const rb = path.join(__dirname, '_purge_9100117027_rollback_2026-06-25.json');
  fs.writeFileSync(rb, JSON.stringify({ generatedAt: '2026-06-25', counts, users, reqs, stores, profiles, authUsers }, null, 2));
  log(`wrote rollback snapshot: ${rb}`);

  // ---- FK-safe deletion ----
  await tryStep('del order_requests', async () => (await prisma.order_requests.deleteMany({ where: { consumer_user_id: { in: IDS } } })).count);
  await tryStep('del merchant_push_tokens', async () => (await prisma.merchantPushToken.deleteMany({ where: { userId: { in: IDS } } })).count);
  await tryStep('del favorite_stores', async () => await prisma.$executeRawUnsafe(`DELETE FROM favorite_stores WHERE user_id IN (${idList})`));
  await tryStep('del merchant_consents', async () => await prisma.$executeRawUnsafe(`DELETE FROM merchant_consents WHERE merchant_id IN (${idList})`));
  await tryStep('del store_staff', async () => await prisma.$executeRawUnsafe(`DELETE FROM store_staff WHERE store_id IN (${storeList}) OR auth_user_id IN (${idList}) OR user_id IN (${idList})`));
  await tryStep('del merchant_settlement_profiles', async () => await prisma.$executeRawUnsafe(`DELETE FROM merchant_settlement_profiles WHERE id IN (${storeList})`));
  await tryStep('del Store', async () => (await prisma.store.deleteMany({ where: { managerId: { in: IDS } } })).count);
  await tryStep('del profiles', async () => await prisma.$executeRawUnsafe(`DELETE FROM profiles WHERE id IN (${idList})`));
  await tryStep('del User', async () => (await prisma.user.deleteMany({ where: { id: { in: IDS } } })).count);

  // auth.users via service-role admin (cascades identities/sessions)
  const supabaseAdmin = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', { auth: { autoRefreshToken: false, persistSession: false } });
  for (const au of authUsers) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(au.id);
    log(`  del auth.users ${au.id}: ${error ? 'ERROR ' + error.message : 'ok'}`);
  }

  await tryStep('del otp_verifications', async () => (await prisma.otpVerification.deleteMany({ where: { phone: { in: PHONES } } })).count);

  // ---- verify ----
  const remUsers = await prisma.user.count({ where: { id: { in: IDS } } });
  const remAuth = await prisma.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS c FROM auth.users WHERE id IN (${idList})`);
  const remMerchants = await prisma.merchant.count({ where: { phone: { in: PHONES } } });
  log(`AFTER: User=${remUsers}, auth.users=${Number(remAuth[0].c)}, merchants=${remMerchants} (all should be 0)`);
  log('done.');
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
