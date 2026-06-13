// Post-lockdown verification for phase9a_merchants_store_lockdown.STAGED.sql.
// Run AFTER applying. All checks must pass.
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  let pass = true;
  const ok = (m: string) => console.log('  ✓ ' + m);
  const fail = (m: string) => { console.log('  ❌ ' + m); pass = false; };

  for (const t of ['merchants', 'Store']) {
    console.log(`\n[${t}]`);
    const w = await p.$queryRaw<any[]>`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name=${t} AND grantee IN ('anon','authenticated')
        AND privilege_type IN ('INSERT','UPDATE','DELETE') ORDER BY 1;`;
    w.length === 0 ? ok('no anon/authenticated write grants') : fail(`write grants remain: ${JSON.stringify(w)}`);
    const s = await p.$queryRaw<any[]>`
      SELECT COUNT(*)::int n FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name=${t} AND grantee IN ('anon','authenticated') AND privilege_type='SELECT';`;
    s[0].n > 0 ? ok(`SELECT preserved (${s[0].n} grants — storefront/discovery intact)`) : fail('SELECT lost — reads would break');
  }

  // service_role (API) can still read/write — sanity.
  const m = await p.merchant.count();
  const st = await p.store.count();
  console.log(`\n  ✓ service_role sees merchants=${m}, Store=${st}`);

  console.log(pass ? '\n═══ LOCKDOWN VERIFIED ═══' : '\n═══ FAILURES — see ❌ ═══');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error('VERIFY FAILED:', e); process.exit(2); }).finally(() => p.$disconnect());
