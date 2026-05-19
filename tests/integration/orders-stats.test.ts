import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createOrder } from '@/lib/orders/orders';
import { confirmOrder } from '@/lib/orders/lifecycle';
import { orderStats } from '@/lib/orders/stats';

describe('orderStats', () => {
  it('counts drafts/confirmed and sums 30-day value', async () => {
    const slug = 'ost-a';
    await q(`delete from tenants where slug=$1`, [slug]);
    const [t] = await q<{ id: string }>(
      `insert into tenants(name,slug) values('X',$1) returning id`, [slug]);
    const [su] = await q<{ id: string }>(
      `insert into shop_users(tenant_id,email,password_hash,full_name)
       values($1,$2,'!shell','B') returning id`, [t.id, `${slug}@x.com`]);
    const [p] = await q<{ id: string }>(
      `insert into products(tenant_id,sku,name,selling_price,cost_price,status,current_quantity)
       values($1,'S1','P',100,60,'active',50) returning id`, [t.id]);
    const mk = (qty: number) => createOrder(t.id, { shopUserId: su.id,
      channel: 'platform', paymentMethod: 'paid',
      lines: [{ productId: p.id, quantity: qty, unitPrice: 100, unitCost: 60 }],
      actor: 'u1' });
    await mk(1);                                  // stays draft
    const confirmedId = await mk(2);
    await confirmOrder(t.id, confirmedId, 'u1');   // confirmed, value 200

    const s = await orderStats(t.id);
    expect(s.draftCount).toBe(1);
    expect(s.confirmedCount).toBe(1);
    expect(s.value30d).toBe(200);
    expect(s.returned30d).toBe(0);
  });
});
