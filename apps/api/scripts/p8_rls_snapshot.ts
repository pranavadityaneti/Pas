// PRE-MIGRATION SNAPSHOT — captures current policies + grants on the 7 RLS-sensitive
// tables, so we have an exact reversal point if anything needs to roll back.
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const tbls = ['User','audit_log','commission_rules','merchant_settlement_profiles','settlement_cycles','settlement_lines','order_items'];
async function main() {
  console.log('═════ PRE-MIGRATION SNAPSHOT — ' + new Date().toISOString() + ' ═════');
  for (const t of tbls) {
    console.log(`\n── ${t} ──`);
    const rls = await p.$queryRaw<any[]>`SELECT relrowsecurity FROM pg_class WHERE relname = ${t};`;
    console.log('  RLS enabled:', rls[0]?.relrowsecurity);
    const pols = await p.$queryRaw<any[]>`SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = ${t} ORDER BY cmd, policyname;`;
    console.log('  policies:', JSON.stringify(pols, null, 2));
    const gr = await p.$queryRaw<any[]>`
      SELECT grantee, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name = ${t} AND grantee IN ('anon','authenticated')
      ORDER BY grantee, privilege_type;`;
    console.log('  grants:', JSON.stringify(gr, null, 2));
  }
}
main().finally(() => p.$disconnect());
