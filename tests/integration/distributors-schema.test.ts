import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';

describe('distributors table', () => {
  it('tenant-scoped, 1:1 shop_user, status default pending, outstanding bounded by limit', async () => {
    await q(`delete from tenants where slug='dst-s'`);
    const [t] = await q<{id:string}>(`insert into tenants(name,slug) values('D','dst-s') returning id`);
    const [su] = await q<{id:string}>(
      `insert into shop_users(tenant_id,email,password_hash,full_name)
       values($1,'d@x.com','!shell','D Biz') returning id`, [t.id]);
    const [d] = await q<{status:string;outstanding:string}>(
      `insert into distributors(tenant_id,shop_user_id,business_name,credit_limit)
       values($1,$2,'D Biz',1000) returning status,outstanding`, [t.id, su.id]);
    expect(d.status).toBe('pending');
    expect(Number(d.outstanding)).toBe(0);
    await expect(q(`insert into distributors(tenant_id,shop_user_id,business_name)
      values($1,$2,'dup')`, [t.id, su.id])).rejects.toThrow(); // unique(tenant,shop_user)
    await expect(q(`update distributors set outstanding=2000 where tenant_id=$1`, [t.id]))
      .rejects.toThrow(); // outstanding <= credit_limit (1000)
    await expect(q(`update distributors set outstanding=-1 where tenant_id=$1`, [t.id]))
      .rejects.toThrow(); // outstanding >= 0
  });
});
