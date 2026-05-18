import { withTenant } from '@/lib/db/withTenant';

export type ActivityEntry = { action:string; actor:string;
  meta:Record<string,unknown>; created_at:string };

export async function listDistributorActivity(tenantId: string,
  distributorId: string): Promise<ActivityEntry[]> {
  return withTenant(tenantId, async c => (await c.query(
    `select action, actor, meta, created_at from audit_log
     where target=$1 and action like 'distributor.%'
     order by created_at desc`, [distributorId])).rows);
}
