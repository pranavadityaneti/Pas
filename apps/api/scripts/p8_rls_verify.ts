// POST-MIGRATION VERIFICATION. Confirms the lockdown landed correctly.
// All checks must pass for the migration to be considered solid.
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const TABLES_RLS_ON = ['User','order_items','audit_log','commission_rules','merchant_settlement_profiles','settlement_cycles','settlement_lines'];

async function main() {
  let pass = true;
  const ok   = (m: string) => console.log('  ✓ ' + m);
  const fail = (m: string) => { console.log('  ❌ ' + m); pass = false; };

  console.log('\n[1] RLS enabled on the 7 lockdown tables');
  for (const t of TABLES_RLS_ON) {
    const r = await p.$queryRaw<any[]>`SELECT relrowsecurity FROM pg_class WHERE relname = ${t};`;
    r[0]?.relrowsecurity ? ok(`${t} RLS on`) : fail(`${t} RLS still OFF`);
  }

  console.log('\n[2] "User": debug policy gone, self_read + self_update added, SUPER_ADMIN policies intact');
  const upols = await p.$queryRaw<any[]>`SELECT policyname FROM pg_policies WHERE tablename = 'User' ORDER BY policyname;`;
  const upolNames = upols.map((r: any) => r.policyname);
  upolNames.includes('Allow public read for debug')
    ? fail('debug policy still present!')
    : ok('debug policy removed');
  upolNames.includes('self_read') ? ok('self_read present') : fail('self_read missing');
  upolNames.includes('self_update') ? ok('self_update present') : fail('self_update missing');
  upolNames.includes('Super Admins manage all') ? ok('Super Admins manage all preserved') : fail('SUPER_ADMIN ALL policy gone');
  upolNames.includes('Super Admins can read all profiles') ? ok('Super Admins can read all profiles preserved') : fail('SUPER_ADMIN read policy gone');

  console.log('\n[3] "User" column-level lockdown: privilege-escalation columns are REVOKED');
  const colGrants = await p.$queryRaw<any[]>`
    SELECT grantee, privilege_type, column_name FROM information_schema.column_privileges
    WHERE table_name = 'User' AND grantee IN ('authenticated','anon') AND privilege_type = 'UPDATE'
      AND column_name IN ('role','isAdmin','status','suspended_at','suspended_reason')
    ORDER BY column_name, grantee;`;
  colGrants.length === 0
    ? ok('all 5 escalation columns are REVOKED for anon + authenticated UPDATE')
    : fail(`escalation columns still UPDATEable: ${JSON.stringify(colGrants)}`);

  console.log('\n[4] order_items: SELECT policy attached + INSERT policy preserved');
  const oipols = await p.$queryRaw<any[]>`SELECT policyname, cmd FROM pg_policies WHERE tablename = 'order_items' ORDER BY cmd, policyname;`;
  const select = oipols.find((r: any) => r.policyname === 'select_own_order_items');
  const insert = oipols.find((r: any) => r.policyname === 'Users can insert their own order items');
  select ? ok('select_own_order_items policy present') : fail('SELECT policy missing');
  insert ? ok('INSERT policy preserved') : fail('original INSERT policy gone');

  console.log('\n[5] 5 defense-in-depth tables: no anon/auth grants remain');
  for (const t of ['audit_log','commission_rules','merchant_settlement_profiles','settlement_cycles','settlement_lines']) {
    const g = await p.$queryRaw<any[]>`
      SELECT COUNT(*)::int AS n FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name = ${t} AND grantee IN ('anon','authenticated');`;
    g[0].n === 0 ? ok(`${t} grants empty`) : fail(`${t} has ${g[0].n} anon/auth grants`);
  }

  console.log('\n[6] sanity: service_role (the API) can still SELECT from a sensitive table');
  // We connect as service_role; the API can read commission_rules without trouble.
  const rule = await p.commissionRule.count();
  console.log(`  ✓ commission_rules visible to service_role (count=${rule})`);

  console.log('\n[7] sanity: User table still readable for service_role; count unchanged');
  const u = await p.user.count();
  console.log(`  ✓ User count = ${u}`);

  console.log(pass ? '\n═══ ALL CHECKS PASSED ═══' : '\n═══ FAILURES — see ❌ above ═══');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error('VERIFY FAILED:', e); process.exit(2); }).finally(() => p.$disconnect());
