import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createOrder, getOrder, listOrders, listOrderItems } from '@/lib/orders/orders';

async function seed(slug: string) {
  await q(`delete from tenants where slug=$1`, [slug]);
  const [t] = await q<{ id: string }>(
    `insert into tenants(name,slug) values('X',$1) returning id`, [slug]);
  const [su] = await q<{ id: string }>(
    `insert into shop_users(tenant_id,email,password_hash,full_name)
     values($1,$2,'!shell','Ada Buyer') returning id`, [t.id, `${slug}@x.com`]);
  const [p] = await q<{ id: string }>(
    `insert into products(tenant_id,sku,name,selling_price,cost_price,status,current_quantity)
     values($1,'S1','P',100,60,'active',50) returning id`, [t.id]);
  const [d] = await q<{ id: string }>(
    `insert into distributors(tenant_id,shop_user_id,business_name,credit_limit,status)
     values($1,$2,'D',100000,'active') returning id`, [t.id, su.id]);
  return { tid: t.id, suid: su.id, pid: p.id, did: d.id };
}

describe('orders domain', () => {
  it('creates a draft order with snapshotted line totals', async () => {
    const { tid, suid, pid } = await seed('od-a');
    const id = await createOrder(tid, {
      shopUserId: suid, channel: 'platform', paymentMethod: 'paid',
      lines: [{ productId: pid, quantity: 3, unitPrice: 100, unitCost: 60 }],
      actor: 'u1',
    });
    const o = await getOrder(tid, id);
    expect(o?.status).toBe('draft');
    expect(Number(o?.total)).toBe(300);
    const items = await listOrderItems(tid, id);
    expect(items).toHaveLength(1);
    expect(Number(items[0].line_total)).toBe(300);
  });

  it('confirmNow creates an external order already confirmed (one tx)', async () => {
    const { tid, suid, pid } = await seed('od-b');
    const id = await createOrder(tid, {
      shopUserId: suid, channel: 'external', paymentMethod: 'paid',
      lines: [{ productId: pid, quantity: 2, unitPrice: 100, unitCost: 60 }],
      actor: 'u1', confirmNow: true,
    });
    const o = await getOrder(tid, id);
    expect(o?.status).toBe('confirmed');
    const [p] = await q<{ current_quantity: number }>(
      `select current_quantity from products where id=$1`, [pid]);
    expect(p.current_quantity).toBe(48);
  });

  it('rejects an empty order and a credit order without a distributor', async () => {
    const { tid, suid, pid } = await seed('od-c');
    await expect(createOrder(tid, {
      shopUserId: suid, channel: 'platform', paymentMethod: 'paid',
      lines: [], actor: 'u1',
    })).rejects.toThrow(/at least one line/i);
    await expect(createOrder(tid, {
      shopUserId: suid, channel: 'platform', paymentMethod: 'credit',
      lines: [{ productId: pid, quantity: 1, unitPrice: 100, unitCost: 60 }],
      actor: 'u1',
    })).rejects.toThrow(/distributor/i);
  });

  it('lists orders newest-first with the customer name, filterable by status', async () => {
    const { tid, suid, pid } = await seed('od-d');
    await createOrder(tid, { shopUserId: suid, channel: 'platform',
      paymentMethod: 'paid', lines: [{ productId: pid, quantity: 1, unitPrice: 100, unitCost: 60 }],
      actor: 'u1' });
    const rows = await listOrders(tid, { status: 'draft' });
    expect(rows).toHaveLength(1);
    expect(rows[0].customer).toBe('Ada Buyer');
    expect(await listOrders(tid, { status: 'confirmed' })).toHaveLength(0);
  });
});
