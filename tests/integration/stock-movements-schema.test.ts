import { describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { q } from '../helpers/db';

describe('stock_movements append-only', () => {
  it('insert ok; update/delete no-op; truncate denied to anon', async () => {
    await q(`delete from tenants where slug='sm-s'`);
    const [t] = await q<{id:string}>(`insert into tenants(name,slug) values('S','sm-s') returning id`);
    const [p] = await q<{id:string}>(
      `insert into products(tenant_id,sku,name,selling_price) values($1,'SM1','x',1) returning id`,[t.id]);
    await q(`insert into stock_movements(tenant_id,product_id,type,qty_delta,actor)
             values($1,$2,'receipt',10,'u1')`,[t.id,p.id]);
    await q(`update stock_movements set qty_delta=999 where tenant_id=$1`,[t.id]);
    const [m] = await q(`select qty_delta from stock_movements where tenant_id=$1`,[t.id]);
    expect(m.qty_delta).toBe(10);
    await q(`delete from stock_movements where tenant_id=$1`,[t.id]);
    const [{n}] = await q<{n:number}>(`select count(*)::int n from stock_movements where tenant_id=$1`,[t.id]);
    expect(n).toBe(1);
    const c = await new Pool({ connectionString: process.env.DATABASE_URL }).connect();
    try {
      await c.query(`set role anon`);
      await expect(c.query(`truncate stock_movements`)).rejects.toThrow(/permission denied/i);
    } finally { await c.query(`reset role`).catch(()=>{}); c.release(); }
  });
});
