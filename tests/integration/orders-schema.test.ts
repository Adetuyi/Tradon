import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { withTenant } from '@/lib/db/withTenant';

async function seedTenant(slug: string) {
  await q(`delete from tenants where slug=$1`, [slug]);
  const [t] = await q<{ id: string }>(
    `insert into tenants(name,slug) values('X',$1) returning id`, [slug]);
  const [su] = await q<{ id: string }>(
    `insert into shop_users(tenant_id,email,password_hash,full_name)
     values($1,$2,'!shell','Buyer') returning id`, [t.id, `${slug}@x.com`]);
  const [p] = await q<{ id: string }>(
    `insert into products(tenant_id,sku,name,selling_price,cost_price,status,current_quantity)
     values($1,'SKU1','Prod',100,60,'active',50) returning id`, [t.id]);
  return { tid: t.id, suid: su.id, pid: p.id };
}

describe('orders schema', () => {
  it('stores an order + items, tenant-scoped, with snapshots', async () => {
    const { tid, suid, pid } = await seedTenant('osch-a');
    const oid = await withTenant(tid, async c => {
      const id = (await c.query(
        `insert into orders(tenant_id,shop_user_id,channel,payment_method,status,total)
         values(current_tenant_id(),$1,'platform','paid','draft',200) returning id`,
        [suid])).rows[0].id as string;
      await c.query(
        `insert into order_items(tenant_id,order_id,product_id,quantity,unit_price,unit_cost,line_total)
         values(current_tenant_id(),$1,$2,2,100,60,200)`, [id, pid]);
      return id;
    });
    const [o] = await q<{ status: string; total: string }>(
      `select status,total from orders where id=$1`, [oid]);
    expect(o.status).toBe('draft');
    expect(Number(o.total)).toBe(200);
    const [{ n }] = await q<{ n: number }>(
      `select count(*)::int n from order_items where order_id=$1`, [oid]);
    expect(n).toBe(1);
  });

  it('rejects an invalid status / non-positive quantity', async () => {
    const { tid, suid, pid } = await seedTenant('osch-b');
    await expect(withTenant(tid, c => c.query(
      `insert into orders(tenant_id,shop_user_id,channel,payment_method,status)
       values(current_tenant_id(),$1,'platform','paid','weird')`, [suid]))).rejects.toThrow();
    const oid = await withTenant(tid, async c => (await c.query(
      `insert into orders(tenant_id,shop_user_id,channel,payment_method,status,total)
       values(current_tenant_id(),$1,'platform','paid','draft',0) returning id`,
      [suid])).rows[0].id as string);
    await expect(withTenant(tid, c => c.query(
      `insert into order_items(tenant_id,order_id,product_id,quantity,unit_price,unit_cost,line_total)
       values(current_tenant_id(),$1,$2,0,100,60,0)`, [oid, pid]))).rejects.toThrow();
  });
});
