import { withTenant } from '@/lib/db/withTenant';

export type ProductStats = { totalActive:number; lowStockCount:number; inventoryValue:number };

export async function productStats(tenantId: string): Promise<ProductStats> {
  return withTenant(tenantId, async c => {
    const r = (await c.query(`
      select
        count(*) filter (where status='active')::int as total_active,
        count(*) filter (where status='active'
          and current_quantity <= reorder_threshold)::int as low_stock,
        coalesce(sum(current_quantity * cost_price)
          filter (where status='active'),0)::float8 as inv_value
      from products`)).rows[0];
    return { totalActive: r.total_active, lowStockCount: r.low_stock,
             inventoryValue: r.inv_value };
  });
}
