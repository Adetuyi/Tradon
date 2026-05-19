import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { withTenant } from '@/lib/db/withTenant';

async function seed(slug: string, opts: { qty?: number; limit?: number;
  distActive?: boolean } = {}) {
  await q(`delete from tenants where slug=$1`, [slug]);
  const [t] = await q<{ id: string }>(
    `insert into tenants(name,slug) values('X',$1) returning id`, [slug]);
  const [su] = await q<{ id: string }>(
    `insert into shop_users(tenant_id,email,password_hash,full_name)
     values($1,$2,'!shell','Buyer') returning id`, [t.id, `${slug}@x.com`]);
  const [p] = await q<{ id: string }>(
    `insert into products(tenant_id,sku,name,selling_price,cost_price,status,current_quantity)
     values($1,'S1','P',100,60,'active',$2) returning id`, [t.id, opts.qty ?? 50]);
  const [d] = await q<{ id: string }>(
    `insert into distributors(tenant_id,shop_user_id,business_name,credit_limit,status)
     values($1,$2,'D',$3,$4) returning id`,
    [t.id, su.id, opts.limit ?? 100000, opts.distActive === false ? 'suspended' : 'active']);
  return { tid: t.id, suid: su.id, pid: p.id, did: d.id };
}

async function makeOrder(tid: string, suid: string, pid: string,
  pay: 'paid' | 'credit', did: string | null, qty: number, price: number) {
  return withTenant(tid, async c => {
    const id = (await c.query(
      `insert into orders(tenant_id,shop_user_id,distributor_id,channel,payment_method,status,total)
       values(current_tenant_id(),$1,$2,'platform',$3,'draft',$4) returning id`,
      [suid, did, pay, qty * price])).rows[0].id as string;
    await c.query(
      `insert into order_items(tenant_id,order_id,product_id,quantity,unit_price,unit_cost,line_total)
       values(current_tenant_id(),$1,$2,$3,$4,60,$5)`, [id, pid, qty, price, qty * price]);
    return id;
  });
}

describe('confirm_order integrity', () => {
  it('decrements stock and (credit) draws credit atomically', async () => {
    const { tid, suid, pid, did } = await seed('oc-a');
    const oid = await makeOrder(tid, suid, pid, 'credit', did, 10, 100);
    await withTenant(tid, c => c.query(`select confirm_order($1,'u1')`, [oid]));
    const [o] = await q<{ status: string }>(`select status from orders where id=$1`, [oid]);
    const [p] = await q<{ current_quantity: number }>(
      `select current_quantity from products where id=$1`, [pid]);
    const [d] = await q<{ outstanding: string }>(
      `select outstanding from distributors where id=$1`, [did]);
    expect(o.status).toBe('confirmed');
    expect(p.current_quantity).toBe(40);          // 50 - 10
    expect(Number(d.outstanding)).toBe(1000);     // 10 * 100
  });

  it('a paid order decrements stock but draws no credit', async () => {
    const { tid, suid, pid, did } = await seed('oc-b');
    const oid = await makeOrder(tid, suid, pid, 'paid', null, 5, 100);
    await withTenant(tid, c => c.query(`select confirm_order($1,'u1')`, [oid]));
    const [{ n }] = await q<{ n: number }>(
      `select count(*)::int n from credit_movements where distributor_id=$1`, [did]);
    expect(n).toBe(0);
    const [p] = await q<{ current_quantity: number }>(
      `select current_quantity from products where id=$1`, [pid]);
    expect(p.current_quantity).toBe(45);
  });

  it('double-confirm raises (status is the idempotency key)', async () => {
    const { tid, suid, pid } = await seed('oc-c');
    const oid = await makeOrder(tid, suid, pid, 'paid', null, 2, 100);
    await withTenant(tid, c => c.query(`select confirm_order($1,'u1')`, [oid]));
    await expect(withTenant(tid, c =>
      c.query(`select confirm_order($1,'u1')`, [oid]))).rejects.toThrow(/only draft/i);
  });

  it('insufficient stock aborts the WHOLE transaction (no partial movement, no credit)', async () => {
    const { tid, suid, pid, did } = await seed('oc-d', { qty: 3 });
    const oid = await makeOrder(tid, suid, pid, 'credit', did, 10, 100);
    await expect(withTenant(tid, c =>
      c.query(`select confirm_order($1,'u1')`, [oid]))).rejects.toThrow();
    const [o] = await q<{ status: string }>(`select status from orders where id=$1`, [oid]);
    const [p] = await q<{ current_quantity: number }>(
      `select current_quantity from products where id=$1`, [pid]);
    const [{ sm }] = await q<{ sm: number }>(
      `select count(*)::int sm from stock_movements where product_id=$1`, [pid]);
    const [{ cm }] = await q<{ cm: number }>(
      `select count(*)::int cm from credit_movements where distributor_id=$1`, [did]);
    expect(o.status).toBe('draft');
    expect(p.current_quantity).toBe(3);
    expect(sm).toBe(0);
    expect(cm).toBe(0);
  });

  it('credit order with an inactive distributor aborts at confirm', async () => {
    const { tid, suid, pid, did } = await seed('oc-e', { distActive: false });
    const oid = await makeOrder(tid, suid, pid, 'credit', did, 1, 100);
    await expect(withTenant(tid, c =>
      c.query(`select confirm_order($1,'u1')`, [oid]))).rejects.toThrow(/active/i);
    const [p] = await q<{ current_quantity: number }>(
      `select current_quantity from products where id=$1`, [pid]);
    expect(p.current_quantity).toBe(50); // stock movement rolled back too
  });
});
