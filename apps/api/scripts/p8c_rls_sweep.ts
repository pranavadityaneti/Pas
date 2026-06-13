// Read-only broad RLS sweep (forlater #8). Flags every public table that is
// either (a) RLS-off while granting writes to anon/authenticated, or
// (b) has a qual=true / permissive write policy. Nothing is changed.
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  // All public base tables + RLS state + anon/auth write grants + permissive policies.
  const rows = await p.$queryRaw<any[]>`
    SELECT
      c.relname AS tbl,
      c.relrowsecurity AS rls_on,
      (SELECT COUNT(*) FROM pg_policies pp WHERE pp.tablename = c.relname)::int AS policies,
      (SELECT COUNT(*) FROM information_schema.role_table_grants g
         WHERE g.table_schema='public' AND g.table_name=c.relname
           AND g.grantee IN ('anon','authenticated')
           AND g.privilege_type IN ('INSERT','UPDATE','DELETE'))::int AS anon_auth_write_grants,
      (SELECT COUNT(*) FROM pg_policies pp WHERE pp.tablename=c.relname
           AND pp.cmd IN ('INSERT','UPDATE','DELETE','ALL')
           AND (pp.qual = 'true' OR pp.with_check = 'true'))::int AS permissive_write_policies
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'
    ORDER BY c.relname;`;

  const risky = rows.filter((r: any) =>
    (r.anon_auth_write_grants > 0 && (!r.rls_on || r.permissive_write_policies > 0)));
  const rlsOffWithGrants = rows.filter((r: any) => !r.rls_on && r.anon_auth_write_grants > 0);

  console.log(`Total public tables: ${rows.length}`);
  console.log(`\n=== HIGH: writable by anon/authenticated AND (RLS off OR permissive write policy) ===`);
  for (const r of risky) {
    console.log(`  ${r.tbl.padEnd(34)} rls=${r.rls_on} policies=${r.policies} writeGrants=${r.anon_auth_write_grants} permissiveWritePol=${r.permissive_write_policies}`);
  }
  console.log(`\n=== Subset: RLS OFF but anon/auth hold write grants (no row protection at all) ===`);
  for (const r of rlsOffWithGrants) console.log(`  ${r.tbl}`);

  // Detail the permissive write policies on the risky tables
  console.log(`\n=== permissive (qual=true) write policies, by table ===`);
  for (const r of risky) {
    const pols = await p.$queryRaw<any[]>`
      SELECT policyname, cmd, qual, with_check FROM pg_policies
      WHERE tablename = ${r.tbl} AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
        AND (qual='true' OR with_check='true') ORDER BY cmd;`;
    if (pols.length) {
      console.log(`  ${r.tbl}:`);
      for (const pp of pols) console.log(`     [${pp.cmd}] ${pp.policyname}`);
    }
  }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1); }).finally(() => p.$disconnect());
