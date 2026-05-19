import { withTenant } from '@/lib/db/withTenant';
import { writeAudit } from '@/lib/compliance/audit';

async function callOrderFn(
  tenantId: string, fn: 'confirm_order' | 'cancel_order' | 'return_order',
  orderId: string, actor: string): Promise<void> {
  await withTenant(tenantId, c =>
    c.query(`select ${fn}($1,$2)`, [orderId, actor]));
}

export async function confirmOrder(
  tenantId: string, orderId: string, actor: string): Promise<void> {
  await callOrderFn(tenantId, 'confirm_order', orderId, actor);
  await writeAudit({ tenantId, actor, action: 'order.confirmed', target: orderId });
}

export async function cancelOrder(
  tenantId: string, orderId: string, actor: string): Promise<void> {
  await callOrderFn(tenantId, 'cancel_order', orderId, actor);
  await writeAudit({ tenantId, actor, action: 'order.cancelled', target: orderId });
}

export async function returnOrder(
  tenantId: string, orderId: string, actor: string): Promise<void> {
  await callOrderFn(tenantId, 'return_order', orderId, actor);
  await writeAudit({ tenantId, actor, action: 'order.returned', target: orderId });
}

export async function fulfillOrder(
  tenantId: string, orderId: string, actor: string): Promise<void> {
  await withTenant(tenantId, async c => {
    const r = (await c.query(
      `select status from orders where id=$1`, [orderId])).rows[0];
    if (!r) throw new Error('order not found');
    if (r.status !== 'confirmed') {
      throw new Error(`order is ${r.status} (only confirmed can be fulfilled)`);
    }
    await c.query(
      `update orders set status='fulfilled', updated_at=now() where id=$1`,
      [orderId]);
  });
  await writeAudit({ tenantId, actor, action: 'order.fulfilled', target: orderId });
}
