import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';

describe('tenant_members', () => {
  it('uniquely links a user to a tenant with a role; platform rows have null tenant', async () => {
    await q(`delete from tenants where slug='mem-t'`);
    const [t] = await q<{id:string}>(`insert into tenants(name,slug)
      values('Mem','mem-t') returning id`);
    const uid = '00000000-0000-0000-0000-000000000001';
    await q(`delete from tenant_members where user_id=$1`, [uid]);
    await q(`insert into tenant_members(user_id,tenant_id,role)
             values($1,$2,'Owner')`, [uid, t.id]);
    await q(`insert into tenant_members(user_id,tenant_id,role,is_platform)
             values($1,null,'Superadmin',true)`, [uid]);
    const rows = await q(`select role from tenant_members where user_id=$1
      order by is_platform`, [uid]);
    expect(rows.map((r:any)=>r.role).sort()).toEqual(['Owner','Superadmin']);
    await expect(q(`insert into tenant_members(user_id,tenant_id,role)
      values($1,$2,'Admin')`, [uid, t.id])).rejects.toThrow();
  });
});
