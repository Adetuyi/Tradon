import { withTenant } from '@/lib/db/withTenant';

export type OrderStats = {
  draftCount: number; confirmedCount: number;
  value30d: number; returned30d: number;
};

export async function orderStats(tenantId: string): Promise<OrderStats> {
  return withTenant(tenantId, async c => {
    const r = (await c.query(`
      select
        count(*) filter (where status='draft')::int as draft_count,
        count(*) filter (where status='confirmed')::int as confirmed_count,
        coalesce(sum(total) filter (
          where status in ('confirmed','fulfilled')
            and created_at > now() - interval '30 days'),0)::float8 as value_30d,
        count(*) filter (
          where status='returned'
            and created_at > now() - interval '30 days')::int as returned_30d
      from orders`)).rows[0];
    return {
      draftCount: r.draft_count,
      confirmedCount: r.confirmed_count,
      value30d: r.value_30d,
      returned30d: r.returned_30d,
    };
  });
}
