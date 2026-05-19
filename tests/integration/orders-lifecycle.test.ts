import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createOrder } from '@/lib/orders/orders';
import { confirmOrder, fulfillOrder, cancelOrder, returnOrder }
  from '@/lib/orders/lifecycle';

async function seed(slug: string) {
  await q(`delete from tenants where slug=$1`, [slug]);
  const [t] = await q<{ id: string }>(
    `insert into tenants(name,slug) values('X',$1) returning id`, [slug]);
  const [su] = await q<{ id: string }>(
    `insert into shop_users(tenant_id,email,password_hash,full_name)
     values($1,$2,'!shell','Buyer') returning id`, [t.id, `${slug}@x.com`]);
  const [p] = await q<{ id: string }>(
    `insert into products(tenant_id,sku,name,selling_price,cost_price,status,current_quantity)
     values($1,'S1','P',100,60,'active',50) returning id`, [t.id]);
  const id = await createOrder(t.id, { shopUserId: su.id, channel: 'platform',
    paymentMethod: 'paid',
    lines: [{ productId: p.id, quantity: 4, unitPrice: 100, unitCost: 60 }],
    actor: 'u1' });
  return { tid: t.id, oid: id };
}

describe('orders lifecycle', () => {
  it('confirm → fulfill writes audit rows and advances status', async () => {
    const { tid, oid } = await seed('ol-a');
    await confirmOrder(tid, oid, 'u1');
    await fulfillOrder(tid, oid, 'u1');
    const [o] = await q<{ status: string }>(`select status from orders where id=$1`, [oid]);
    expect(o.status).toBe('fulfilled');
    const acts = await q<{ action: string }>(
      `select action from audit_log where target=$1 order by created_at`, [oid]);
    expect(acts.map(a => a.action))
      .toEqual(['order.confirmed', 'order.fulfilled']);
  });

  it('fulfill is rejected unless the order is confirmed', async () => {
    const { tid, oid } = await seed('ol-b');
    await expect(fulfillOrder(tid, oid, 'u1')).rejects.toThrow(/only confirmed/i);
  });

  it('cancel after confirm writes order.cancelled audit', async () => {
    const { tid, oid } = await seed('ol-c');
    await confirmOrder(tid, oid, 'u1');
    await cancelOrder(tid, oid, 'u1');
    const [o] = await q<{ status: string }>(`select status from orders where id=$1`, [oid]);
    expect(o.status).toBe('cancelled');
    const [{ n }] = await q<{ n: number }>(
      `select count(*)::int n from audit_log where target=$1 and action='order.cancelled'`,
      [oid]);
    expect(n).toBe(1);
  });

  it('return after confirm sets returned status', async () => {
    const { tid, oid } = await seed('ol-d');
    await confirmOrder(tid, oid, 'u1');
    await returnOrder(tid, oid, 'u1');
    const [o] = await q<{ status: string }>(`select status from orders where id=$1`, [oid]);
    expect(o.status).toBe('returned');
  });
});
