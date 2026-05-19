import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { withTenant } from '@/lib/db/withTenant';

async function seedConfirmed(slug: string, pay: 'paid' | 'credit') {
  await q(`delete from tenants where slug=$1`, [slug]);
  const [t] = await q<{ id: string }>(
    `insert into tenants(name,slug) values('X',$1) returning id`, [slug]);
  const [su] = await q<{ id: string }>(
    `insert into shop_users(tenant_id,email,password_hash,full_name)
     values($1,$2,'!shell','Buyer') returning id`, [t.id, `${slug}@x.com`]);
  const [p] = await q<{ id: string }>(
    `insert into products(tenant_id,sku,name,selling_price,cost_price,status,current_quantity)
     values($1,'S1','P',100,60,'active',50) returning id`, [t.id]);
  const [d] = await q<{ id: string }>(
    `insert into distributors(tenant_id,shop_user_id,business_name,credit_limit,status)
     values($1,$2,'D',100000,'active') returning id`, [t.id, su.id]);
  const did = pay === 'credit' ? d.id : null;
  const oid = await withTenant(t.id, async c => {
    const id = (await c.query(
      `insert into orders(tenant_id,shop_user_id,distributor_id,channel,payment_method,status,total)
       values(current_tenant_id(),$1,$2,'platform',$3,'draft',1000) returning id`,
      [su.id, did, pay])).rows[0].id as string;
    await c.query(
      `insert into order_items(tenant_id,order_id,product_id,quantity,unit_price,unit_cost,line_total)
       values(current_tenant_id(),$1,$2,10,100,60,1000)`, [id, p.id]);
    await c.query(`select confirm_order($1,'u1')`, [id]);
    return id;
  });
  return { tid: t.id, pid: p.id, did: d.id, oid };
}

describe('cancel_order / return_order integrity', () => {
  it('cancel restores stock and reverses the credit draw', async () => {
    const { tid, pid, did, oid } = await seedConfirmed('or-a', 'credit');
    await withTenant(tid, c => c.query(`select cancel_order($1,'u1')`, [oid]));
    const [o] = await q<{ status: string }>(`select status from orders where id=$1`, [oid]);
    const [p] = await q<{ current_quantity: number }>(
      `select current_quantity from products where id=$1`, [pid]);
    const [d] = await q<{ outstanding: string }>(
      `select outstanding from distributors where id=$1`, [did]);
    expect(o.status).toBe('cancelled');
    expect(p.current_quantity).toBe(50);       // 50 -10 +10
    expect(Number(d.outstanding)).toBe(0);     // +1000 then -1000
  });

  it('return sets status=returned and restores a paid order stock (no credit row)', async () => {
    const { tid, pid, did, oid } = await seedConfirmed('or-b', 'paid');
    await withTenant(tid, c => c.query(`select return_order($1,'u1')`, [oid]));
    const [o] = await q<{ status: string }>(`select status from orders where id=$1`, [oid]);
    const [p] = await q<{ current_quantity: number }>(
      `select current_quantity from products where id=$1`, [pid]);
    const [{ n }] = await q<{ n: number }>(
      `select count(*)::int n from credit_movements where distributor_id=$1`, [did]);
    expect(o.status).toBe('returned');
    expect(p.current_quantity).toBe(50);
    expect(n).toBe(0);
  });

  it('cannot reverse a draft, and cannot double-reverse', async () => {
    const { tid, oid } = await seedConfirmed('or-c', 'paid');
    await withTenant(tid, c => c.query(`select cancel_order($1,'u1')`, [oid]));
    await expect(withTenant(tid, c =>
      c.query(`select return_order($1,'u1')`, [oid]))).rejects.toThrow(/only confirmed/i);
  });
});
