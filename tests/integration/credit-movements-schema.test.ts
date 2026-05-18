import { describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { q } from '../helpers/db';

describe('credit_movements append-only', () => {
  it('insert ok; update/delete no-op; truncate denied to anon', async () => {
    await q(`delete from tenants where slug='cm-s'`);
    const [t] = await q<{id:string}>(`insert into tenants(name,slug) values('C','cm-s') returning id`);
    const [su] = await q<{id:string}>(
      `insert into shop_users(tenant_id,email,password_hash,full_name)
       values($1,'c@x.com','!shell','C') returning id`, [t.id]);
    const [d] = await q<{id:string}>(
      `insert into distributors(tenant_id,shop_user_id,business_name,credit_limit)
       values($1,$2,'C',5000) returning id`, [t.id, su.id]);
    await q(`insert into credit_movements(tenant_id,distributor_id,type,delta,actor)
             values($1,$2,'purchase_draw',100,'u1')`, [t.id, d.id]);
    await q(`update credit_movements set delta=999 where tenant_id=$1`, [t.id]);
    const [m] = await q(`select delta from credit_movements where tenant_id=$1`, [t.id]);
    expect(Number(m.delta)).toBe(100);
    await q(`delete from credit_movements where tenant_id=$1`, [t.id]);
    const [{n}] = await q<{n:number}>(
      `select count(*)::int n from credit_movements where tenant_id=$1`, [t.id]);
    expect(n).toBe(1);
    const c = await new Pool({ connectionString: process.env.DATABASE_URL }).connect();
    try {
      await c.query(`set role anon`);
      await expect(c.query(`truncate credit_movements`)).rejects.toThrow(/permission denied/i);
    } finally { await c.query(`reset role`).catch(()=>{}); c.release(); }
  });
});
