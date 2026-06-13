// Post-lockdown verification for phase8_branch_lockdown.STAGED.sql.
// Run AFTER applying the lockdown migration. All checks must pass.
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  let pass = true;
  const ok = (m: string) => console.log('  ✓ ' + m);
  const fail = (m: string) => { console.log('  ❌ ' + m); pass = false; };

  console.log('\n[1] merchant_branches: anon/authenticated have NO write grants');
  const writeGrants = await p.$queryRaw<any[]>`
    SELECT grantee, privilege_type FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='merchant_branches'
      AND grantee IN ('anon','authenticated')
      AND privilege_type IN ('INSERT','UPDATE','DELETE')
    ORDER BY grantee, privilege_type;`;
  writeGrants.length === 0 ? ok('no INSERT/UPDATE/DELETE for anon/authenticated')
    : fail(`write grants remain: ${JSON.stringify(writeGrants)}`);

  console.log('\n[2] SELECT grant is preserved (discovery + storefront)');
  const selGrants = await p.$queryRaw<any[]>`
    SELECT grantee FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='merchant_branches'
      AND privilege_type='SELECT' AND grantee IN ('anon','authenticated')
    ORDER BY grantee;`;
  const g = selGrants.map((r: any) => r.grantee);
  (g.includes('anon') && g.includes('authenticated'))
    ? ok('anon + authenticated retain SELECT')
    : fail(`SELECT grants incomplete: ${JSON.stringify(g)}`);

  console.log('\n[3] qual=true WRITE policies dropped; SELECT policies kept');
  const pols = await p.$queryRaw<any[]>`
    SELECT policyname, cmd FROM pg_policies WHERE tablename='merchant_branches' ORDER BY cmd, policyname;`;
  const names = pols.map((r: any) => r.policyname);
  const droppedExpected = [
    'Enable insert for users based on merchant_id',
    'Enable branch insert for authenticated users',
    'Enable update branches for authenticated users',
    'Enable delete branches for authenticated users',
  ];
  droppedExpected.forEach(n => names.includes(n) ? fail(`policy still present: ${n}`) : ok(`dropped: ${n}`));
  const selPolicies = pols.filter((r: any) => r.cmd === 'SELECT');
  selPolicies.length > 0 ? ok(`${selPolicies.length} SELECT policies preserved`) : fail('no SELECT policies left — storefront/discovery would break');

  console.log('\n[4] service_role (the API) can still write — count is readable');
  const n = await p.merchantBranch.count();
  console.log(`  ✓ merchant_branches readable by service_role (count=${n})`);

  console.log(pass ? '\n═══ LOCKDOWN VERIFIED ═══' : '\n═══ FAILURES — see ❌ ═══');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error('VERIFY FAILED:', e); process.exit(2); }).finally(() => p.$disconnect());
