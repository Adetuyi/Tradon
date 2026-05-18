import { withTenant } from '@/lib/db/withTenant';

export type DistributorStats = { totalActive:number; pendingCount:number;
  totalOutstanding:number; overLimitCount:number };

export async function distributorStats(tenantId: string): Promise<DistributorStats> {
  return withTenant(tenantId, async c => {
    const r = (await c.query(`
      select
        count(*) filter (where status='active')::int as total_active,
        count(*) filter (where status='pending')::int as pending_count,
        coalesce(sum(outstanding) filter (where status <> 'archived'),0)::float8 as total_out,
        count(*) filter (where status='active'
          and outstanding >= credit_limit and credit_limit > 0)::int as over_limit
      from distributors`)).rows[0];
    return { totalActive: r.total_active, pendingCount: r.pending_count,
             totalOutstanding: r.total_out, overLimitCount: r.over_limit };
  });
}
