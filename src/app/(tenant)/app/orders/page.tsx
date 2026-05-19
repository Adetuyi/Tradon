import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { AppShell } from '@/components/ui/AppShell';
import { listOrders } from '@/lib/orders/orders';
import { orderStats } from '@/lib/orders/stats';
import { listDistributors } from '@/lib/distributors/distributors';
import { listProducts } from '@/lib/products/products';
import { withTenant } from '@/lib/db/withTenant';
import { NewOrderForm } from './NewOrderForm';
import { confirmOrderAction } from './actions';

export const dynamic = 'force-dynamic';

function statusBadge(s: string): string {
  if (s === 'confirmed') return 'bg-green-50 text-primary-700 border-green-200';
  if (s === 'fulfilled') return 'bg-green-50 text-primary border-green-200';
  if (s === 'cancelled') return 'bg-surface-2 text-negative border-hairline';
  if (s === 'returned') return 'bg-surface-2 text-signal border-hairline';
  return 'bg-surface-2 text-muted border-hairline'; // draft
}

export default async function OrdersPage({ searchParams }:
  { searchParams: Promise<{ q?: string; status?: string; channel?: string }> }) {
  const sp = await searchParams;
  const tenant = await resolveTenant((await headers()).get('host') ?? '');
  if (!tenant) redirect('/not-found-tenant');
  const session = await getStaffSession(tenant.id);
  if (!session) redirect('/login');
  const principal = session.membership
    ? { role: session.membership.role, isPlatform: false } : null;
  await requirePermission(principal, 'orders.read');

  const [stats, rows, dists, prods, customers] = await Promise.all([
    orderStats(tenant.id),
    listOrders(tenant.id, { search: sp.q, status: sp.status, channel: sp.channel }),
    listDistributors(tenant.id, { status: 'active' }),
    listProducts(tenant.id, {}),
    withTenant(tenant.id, async c => (await c.query<{ id: string; full_name: string }>(
      `select id, full_name from shop_users order by full_name limit 200`)).rows),
  ]);
  const fmt = (n: number) => '₦' + n.toLocaleString('en-NG');

  return (
    <AppShell tenantName={tenant.slug} role={session.membership!.role}>
      <div className="w-full max-w-[1100px]">
        <div className="flex items-center justify-between gap-4 mb-5">
          <h1 className="font-display font-bold text-2xl text-ink">Orders</h1>
          <NewOrderForm
            customers={customers}
            distributors={dists.map(d => ({ id: d.id, business_name: d.business_name }))}
            products={prods.map(p => ({ id: p.id, name: p.name,
              selling_price: p.selling_price, cost_price: p.cost_price }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          {[['Draft', String(stats.draftCount), false],
            ['Confirmed', String(stats.confirmedCount), false],
            ['Value (30d)', fmt(stats.value30d), false],
            ['Returned (30d)', String(stats.returned30d), true]].map(([l, v, warn]) => (
            <div key={l as string} className="bg-surface border border-hairline rounded-card p-5">
              <div className="text-[11px] uppercase tracking-wide text-muted">{l}</div>
              <div className={`font-display font-bold text-2xl mt-2 ${
                warn ? 'text-negative' : 'text-ink'}`}>{v}</div>
            </div>
          ))}
        </div>

        <div className="bg-surface border border-hairline rounded-card overflow-hidden">
          <div className="overflow-x-auto"><div className="min-w-[860px]">
            <div className="grid grid-cols-[0.9fr_1.5fr_0.8fr_0.8fr_0.9fr_1fr_0.9fr_0.9fr]
              bg-surface-2 text-[10.5px] uppercase tracking-wide text-muted font-semibold">
              {['Order','Customer','Channel','Payment','Status','Total','Date','Actions']
                .map(h => <div key={h} className="px-4 py-3">{h}</div>)}
            </div>
            {rows.length === 0 && (
              <div className="px-4 py-14 text-center text-muted text-sm">No orders yet.</div>)}
            {rows.map(o => (
              <div key={o.id} className="border-t border-hairline">
                <div className="grid grid-cols-[0.9fr_1.5fr_0.8fr_0.8fr_0.9fr_1fr_0.9fr_0.9fr]
                  text-[13px] items-center">
                  <Link href={`/app/orders/${o.id}`}
                    className="px-4 py-3 font-mono text-ink hover:underline">
                    #{o.id.slice(0, 8)}</Link>
                  <div className="px-4 py-3 text-ink">{o.customer}</div>
                  <div className="px-4 py-3 text-muted capitalize">{o.channel}</div>
                  <div className="px-4 py-3 text-muted capitalize">{o.payment_method}</div>
                  <div className="px-4 py-3">
                    <span className={`font-mono text-[10.5px] px-2.5 py-1 rounded-full border
                      ${statusBadge(o.status)}`}>{o.status}</span></div>
                  <div className="px-4 py-3 font-mono">{fmt(Number(o.total))}</div>
                  <div className="px-4 py-3 font-mono text-muted text-xs">
                    {new Date(o.created_at).toLocaleDateString('en-NG',
                      { day: '2-digit', month: 'short' })}</div>
                  <div className="px-4 py-3 flex gap-3 items-center">
                    <Link href={`/app/orders/${o.id}`}
                      className="text-xs text-signal font-medium">View</Link>
                    {o.status === 'draft' && (
                      <form action={confirmOrderAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <button type="submit"
                          className="text-xs text-primary font-semibold">Confirm</button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div></div>
        </div>
      </div>
    </AppShell>
  );
}
