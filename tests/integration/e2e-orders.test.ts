import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createOrder, getOrder } from '@/lib/orders/orders';
import { confirmOrder, cancelOrder } from '@/lib/orders/lifecycle';

async function seed(slug: string) {
  await q(`delete from tenants where slug=$1`, [slug]);
  const [t] = await q<{ id: string }>(
    `insert into tenants(name,slug) values('X',$1) returning id`, [slug]);
  const [su] = await q<{ id: string }>(
    `insert into shop_users(tenant_id,email,password_hash,full_name)
     values($1,$2,'!shell','Buyer') returning id`, [t.id, `${slug}@x.com`]);
  const [p] = await q<{ id: string }>(
    `insert into products(tenant_id,sku,name,selling_price,cost_price,status,current_quantity)
     values($1,'S1','P',100,60,'active',100) returning id`, [t.id]);
  const [d] = await q<{ id: string }>(
    `insert into distributors(tenant_id,shop_user_id,business_name,credit_limit,status)
     values($1,$2,'D',50000,'active') returning id`, [t.id, su.id]);
  return { tid: t.id, suid: su.id, pid: p.id, did: d.id };
}

describe('orders E2E', () => {
  it('credit order: draft → confirm draws credit + decrements stock → cancel reverses', async () => {
    const { tid, suid, pid, did } = await seed('e2eo-a');
    const oid = await createOrder(tid, {
      shopUserId: suid, distributorId: did, channel: 'platform',
      paymentMethod: 'credit',
      lines: [{ productId: pid, quantity: 10, unitPrice: 100, unitCost: 60 }],
      actor: 'u1',
    });
    expect((await getOrder(tid, oid))?.status).toBe('draft');

    await confirmOrder(tid, oid, 'u1');
    let [p] = await q<{ current_quantity: number }>(
      `select current_quantity from products where id=$1`, [pid]);
    let [d] = await q<{ outstanding: string }>(
      `select outstanding from distributors where id=$1`, [did]);
    expect(p.current_quantity).toBe(90);
    expect(Number(d.outstanding)).toBe(1000);

    await cancelOrder(tid, oid, 'u1');
    [p] = await q<{ current_quantity: number }>(
      `select current_quantity from products where id=$1`, [pid]);
    [d] = await q<{ outstanding: string }>(
      `select outstanding from distributors where id=$1`, [did]);
    expect((await getOrder(tid, oid))?.status).toBe('cancelled');
    expect(p.current_quantity).toBe(100);
    expect(Number(d.outstanding)).toBe(0);
  });

  it('external order is created already confirmed and decrements stock at once', async () => {
    const { tid, suid, pid } = await seed('e2eo-b');
    const oid = await createOrder(tid, {
      shopUserId: suid, channel: 'external', paymentMethod: 'paid',
      lines: [{ productId: pid, quantity: 7, unitPrice: 150, unitCost: 90 }],
      actor: 'u1', confirmNow: true,
    });
    expect((await getOrder(tid, oid))?.status).toBe('confirmed');
    const [p] = await q<{ current_quantity: number }>(
      `select current_quantity from products where id=$1`, [pid]);
    expect(p.current_quantity).toBe(93);
  });

  it('tenant isolation: an order is invisible to another tenant', async () => {
    const a = await seed('e2eo-c');
    const b = await seed('e2eo-d');
    const oid = await createOrder(a.tid, { shopUserId: a.suid,
      channel: 'platform', paymentMethod: 'paid',
      lines: [{ productId: a.pid, quantity: 1, unitPrice: 100, unitCost: 60 }],
      actor: 'u1' });
    expect(await getOrder(b.tid, oid)).toBeNull();
  });
});
