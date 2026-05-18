import { withTenant } from '@/lib/db/withTenant';

export type CreditType = 'purchase_draw'|'repayment'|'adjustment';
export type CreditMovement = { id:string; type:CreditType; delta:string;
  reason:string|null; actor:string; created_at:string };

export async function recordCreditMovement(tenantId: string, m: {
  distributorId: string; type: CreditType; delta: number;
  reason?: string | null; actor: string;
}): Promise<void> {
  await withTenant(tenantId, c => c.query(
    `select record_credit_movement($1,$2,$3,$4,$5)`,
    [m.distributorId, m.type, m.delta, m.reason ?? null, m.actor]));
}
export async function listCreditMovements(tenantId: string,
  distributorId: string): Promise<CreditMovement[]> {
  return withTenant(tenantId, async c => (await c.query(
    `select id,type,delta,reason,actor,created_at from credit_movements
     where distributor_id=$1 order by created_at desc`, [distributorId])).rows);
}
