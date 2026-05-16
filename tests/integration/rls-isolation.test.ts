import { describe, it, expect } from 'vitest';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL!;
describe('RLS isolation on a tenant-owned probe table', () => {
  it('a tenant session cannot read another tenant rows', async () => {
    const admin = new Pool({ connectionString: url });
    await admin.query(`create table if not exists _probe (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null references tenants(id), note text)`);
    await admin.query(`alter table _probe enable row level security`);
    await admin.query(`drop policy if exists _probe_iso on _probe`);
    await admin.query(`create policy _probe_iso on _probe
      using (tenant_id = current_tenant_id())
      with check (tenant_id = current_tenant_id())`);
    await admin.query(`grant select,insert on _probe to anon`);
    const [{ id: a }] = (await admin.query(
      `insert into tenants(name,slug) values('A','iso-a')
       on conflict(slug) do update set name=excluded.name returning id`)).rows;
    const [{ id: b }] = (await admin.query(
      `insert into tenants(name,slug) values('B','iso-b')
       on conflict(slug) do update set name=excluded.name returning id`)).rows;
    await admin.query(`delete from _probe`);
    await admin.query(`insert into _probe(tenant_id,note) values($1,'a-secret')`,[a]);
    await admin.query(`insert into _probe(tenant_id,note) values($1,'b-secret')`,[b]);

    const c = await new Pool({ connectionString: url }).connect();
    await c.query(`set role anon`);
    await c.query(`select set_config('app.current_tenant_id',$1,false)`,[a]);
    const rows = (await c.query(`select note from _probe`)).rows;
    expect(rows.map(r => r.note)).toEqual(['a-secret']);
    await c.query(`reset role`); c.release();
    await admin.query(`drop table _probe`); await admin.end();
  });
});
