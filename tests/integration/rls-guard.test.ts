import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';

/** Any public table with a tenant_id column MUST have RLS enabled
 *  AND a policy referencing current_tenant_id(). */
describe('RLS schema guard', () => {
  it('no tenant-owned table is unprotected', async () => {
    const tenantTables = await q<{ table_name: string; oid: string }>(`
      select c.relname as table_name, c.oid::text as oid
      from pg_attribute a
      join pg_class c on c.oid=a.attrelid
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and a.attname='tenant_id'
        and c.relkind='r' and not a.attisdropped`);
    const failures: string[] = [];
    for (const { table_name, oid } of tenantTables) {
      const [{ relrowsecurity }] = await q<{ relrowsecurity: boolean }>(
        `select relrowsecurity from pg_class where oid=$1`, [oid]);
      const pols = await q<{ qual: string }>(
        `select pg_get_expr(polqual, polrelid) as qual
         from pg_policy p
         where p.polrelid=$1`, [oid]);
      const guarded = pols.some(p => (p.qual ?? '').includes('current_tenant_id'));
      if (!relrowsecurity || !guarded) failures.push(table_name);
    }
    expect(failures, `Unprotected tenant tables: ${failures.join(', ')}`).toEqual([]);
  });
});
