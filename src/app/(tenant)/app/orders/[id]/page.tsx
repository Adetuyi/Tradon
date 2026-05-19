import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { AppShell } from '@/components/ui/AppShell';
import { getOrder, listOrderItems } from '@/lib/orders/orders';
import { getDistributor } from '@/lib/distributors/distributors';
import { withTenant } from '@/lib/db/withTenant';
import { LifecycleActions } from '../LifecycleActions';

export const dynamic = 'force-dynamic';

function statusBadge(s: string): string {
  if (s === 'confirmed') return 'bg-green-50 text-primary-700 border-green-200';
  if (s === 'fulfilled') return 'bg-green-50 text-primary border-green-200';
  if (s === 'cancelled') return 'bg-surface-2 text-negative border-hairline';
  if (s === 'returned') return 'bg-surface-2 text-signal border-hairline';
  return 'bg-surface-2 text-muted border-hairline';
}
function fmt(n: number): string { return '₦' + n.toLocaleString('en-NG'); }
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG',
    { day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit' });
}

export default async function OrderDetail({ params }:
  { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await resolveTenant((await headers()).get('host') ?? '');
  if (!tenant) redirect('/not-found-tenant');
  const session = await getStaffSession(tenant.id);
  if (!session) redirect('/login');
  const principal = session.membership
    ? { role: session.membership.role, isPlatform: false } : null;
  await requirePermission(principal, 'orders.read');

  const o = await getOrder(tenant.id, id);
  if (!o) notFound();

  const [items, customer, dist, activity] = await Promise.all([
    listOrderItems(tenant.id, id),
    withTenant(tenant.id, async c => (await c.query<{ full_name: string; email: string }>(
      `select full_name, email from shop_users where id=$1`,
      [o.shop_user_id])).rows[0]),
    o.distributor_id ? getDistributor(tenant.id, o.distributor_id)
      : Promise.resolve(null),
    withTenant(tenant.id, async c => (await c.query<
      { action: string; actor: string; created_at: string }>(
      `select action, actor, created_at from audit_log
       where target=$1 order by created_at desc`, [id])).rows),
  ]);

  return (
    <AppShell tenantName={tenant.slug} role={session.membership!.role}>
      <div className="w-full max-w-[1100px]">
        <Link href="/app/orders"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            className="w-3.5 h-3.5"><path d="M15 18l-6-6 6-6" /></svg>
          Orders
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-ink font-mono">
              Order #{o.id.slice(0, 8)}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`font-mono text-[10.5px] px-2.5 py-1 rounded-full border
                ${statusBadge(o.status)}`}>{o.status}</span>
              <span className="font-mono text-[10.5px] px-2.5 py-1 rounded-full border
                bg-surface-2 text-signal border-hairline capitalize">
                {o.payment_method}</span>
              <span className="font-mono text-[10.5px] px-2.5 py-1 rounded-full border
                bg-green-50 text-primary-700 border-green-200 capitalize">
                {o.channel}</span>
              <span className="text-xs text-muted">
                · placed {fmtDateTime(o.created_at)}</span>
            </div>
          </div>
          <LifecycleActions id={o.id} status={o.status} />
        </div>

        <div className="bg-surface border border-hairline rounded-card p-5 mb-6">
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4">
            {[
              { k: 'Customer', v: customer
                ? `${customer.full_name} · ${customer.email}` : '—' },
              { k: 'Distributor (on credit)', v: dist
                ? `${dist.business_name} · ${dist.status}` : '—' },
              { k: 'Channel', v: o.channel },
              { k: 'Payment method', v: o.payment_method === 'credit'
                ? 'Credit (draws distributor credit on confirm)' : 'Paid' },
              { k: 'Status', v: o.status },
              { k: 'Total', v: fmt(Number(o.total)) },
            ].map(row => (
              <div key={row.k} className="flex flex-col gap-0.5">
                <dt className="text-[11px] uppercase tracking-wide text-muted">{row.k}</dt>
                <dd className="text-sm text-ink capitalize">{row.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-surface border border-hairline rounded-card overflow-hidden mb-6">
          <div className="px-5 py-3.5 border-b border-hairline font-display font-semibold
            text-sm text-ink">Line items · price &amp; cost snapshotted at order time</div>
          <div className="overflow-x-auto"><div className="min-w-[560px]">
            <div className="grid grid-cols-[2fr_0.7fr_1fr_1fr] bg-surface-2
              text-[10.5px] uppercase tracking-wide text-muted font-semibold">
              {['Product','Qty','Unit price','Line total'].map(h =>
                <div key={h} className="px-4 py-3">{h}</div>)}
            </div>
            {items.map(it => (
              <div key={it.id} className="grid grid-cols-[2fr_0.7fr_1fr_1fr]
                border-t border-hairline text-[13px] items-center">
                <div className="px-4 py-3 text-ink font-mono text-xs">{it.product_id}</div>
                <div className="px-4 py-3 font-mono">{it.quantity}</div>
                <div className="px-4 py-3 font-mono">{fmt(Number(it.unit_price))}</div>
                <div className="px-4 py-3 font-mono">{fmt(Number(it.line_total))}</div>
              </div>
            ))}
            <div className="grid grid-cols-[2fr_0.7fr_1fr_1fr] border-t border-hairline
              bg-surface-2 text-[13px] items-center font-display font-bold text-ink">
              <div className="px-4 py-3">Total</div><div /><div />
              <div className="px-4 py-3 font-mono">{fmt(Number(o.total))}</div>
            </div>
          </div></div>
        </div>

        <div className="bg-surface border border-hairline rounded-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-hairline font-display font-semibold
            text-sm text-ink">Activity</div>
          <div className="overflow-x-auto"><div className="min-w-[480px]">
            <div className="grid grid-cols-[1.4fr_1.2fr_1.4fr] bg-surface-2
              text-[10.5px] uppercase tracking-wide text-muted font-semibold">
              {['Action','Actor','When'].map(h =>
                <div key={h} className="px-4 py-3">{h}</div>)}
            </div>
            {activity.length === 0 && (
              <div className="px-4 py-10 text-center text-muted text-sm">
                No activity yet.</div>)}
            {activity.map((a, i) => (
              <div key={i} className="grid grid-cols-[1.4fr_1.2fr_1.4fr]
                border-t border-hairline text-[13px] items-center">
                <div className="px-4 py-2.5 font-mono text-xs text-ink">{a.action}</div>
                <div className="px-4 py-2.5 font-mono text-xs text-muted">{a.actor}</div>
                <div className="px-4 py-2.5 text-xs text-muted">
                  {fmtDateTime(a.created_at)}</div>
              </div>
            ))}
          </div></div>
        </div>
      </div>
    </AppShell>
  );
}
