import { withTenant } from '@/lib/db/withTenant';

export type MovementType = 'receipt'|'adjustment'|'sale'|'return';
export type Movement = { id:string; type:MovementType; qty_delta:number;
  unit_cost:string|null; reason:string|null; actor:string; created_at:string };

export async function recordStockMovement(tenantId: string, m: {
  productId: string; type: MovementType; qtyDelta: number;
  unitCost?: number | null; reason?: string | null; actor: string;
}): Promise<void> {
  await withTenant(tenantId, c => c.query(
    `select record_stock_movement($1,$2,$3,$4,$5,$6)`,
    [m.productId, m.type, m.qtyDelta, m.unitCost ?? null, m.reason ?? null, m.actor]));
}

export async function listMovements(tenantId: string, productId: string): Promise<Movement[]> {
  return withTenant(tenantId, async c => (await c.query(
    `select id,type,qty_delta,unit_cost,reason,actor,created_at
     from stock_movements where product_id=$1 order by created_at desc`, [productId])).rows);
}
