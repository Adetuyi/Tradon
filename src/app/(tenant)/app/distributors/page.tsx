import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { AppShell } from '@/components/ui/AppShell';
import { listDistributors } from '@/lib/distributors/distributors';
import { distributorStats } from '@/lib/distributors/stats';

export const dynamic = 'force-dynamic';

export default async function DistributorsPage({ searchParams }:
  { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const tenant = await resolveTenant((await headers()).get('host') ?? '');
  if (!tenant) redirect('/not-found-tenant');
  const session = await getStaffSession(tenant.id);
  if (!session) redirect('/login');
  const principal = session.membership
    ? { role: session.membership.role, isPlatform: false } : null;
  await requirePermission(principal, 'distributors.read');

  const [stats, rows] = await Promise.all([
    distributorStats(tenant.id),
    listDistributors(tenant.id, { search: sp.q, status: sp.status }),
  ]);
  const fmt = (n: number) => '₦' + n.toLocaleString('en-NG');

  return (
    <AppShell tenantName={tenant.slug} role={session.membership!.role}>
      <div className="w-full max-w-[1100px]">
        <h1 className="font-display font-bold text-2xl text-ink mb-5">Distributors</h1>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          {[['Active', String(stats.totalActive), false],
            ['Pending', String(stats.pendingCount), false],
            ['Total outstanding', fmt(stats.totalOutstanding), false],
            ['Over-limit', String(stats.overLimitCount), true]].map(([l,v,warn]) => (
            <div key={l as string} className="bg-surface border border-hairline rounded-card p-5">
              <div className="text-[11px] uppercase tracking-wide text-muted">{l}</div>
              <div className={`font-display font-bold text-2xl mt-2 ${
                warn ? 'text-negative' : 'text-ink'}`}>{v}</div>
            </div>
          ))}
        </div>
        <div className="bg-surface border border-hairline rounded-card overflow-hidden">
          <div className="overflow-x-auto"><div className="min-w-[820px]">
            <div className="grid grid-cols-[1.8fr_1fr_0.8fr_0.9fr_0.9fr_0.9fr] bg-surface-2
              text-[10.5px] uppercase tracking-wide text-muted font-semibold">
              {['Business','Region','Status','Limit','Outstanding','Available'].map(h =>
                <div key={h} className="px-4 py-3">{h}</div>)}
            </div>
            {rows.length === 0 && (
              <div className="px-4 py-14 text-center text-muted text-sm">
                No distributors yet.</div>)}
            {rows.map(d => {
              const avail = Number(d.credit_limit) - Number(d.outstanding);
              const badge = d.status==='active' ? 'bg-green-50 text-primary-700 border-green-200'
                : d.status==='pending' ? 'bg-surface-2 text-signal border-hairline'
                : d.status==='suspended' ? 'bg-surface-2 text-negative border-hairline'
                : 'bg-surface-2 text-muted border-hairline';
              return (
              <Link key={d.id} href={`/app/distributors/${d.id}`}
                className="grid grid-cols-[1.8fr_1fr_0.8fr_0.9fr_0.9fr_0.9fr]
                border-t border-hairline text-[13px] items-center hover:bg-surface-2">
                <div className="px-4 py-3 text-ink font-medium">{d.business_name}</div>
                <div className="px-4 py-3 text-muted">{d.region ?? '—'}</div>
                <div className="px-4 py-3"><span className={`font-mono text-[10.5px]
                  px-2.5 py-1 rounded-full border ${badge}`}>{d.status}</span></div>
                <div className="px-4 py-3 font-mono text-muted">{fmt(Number(d.credit_limit))}</div>
                <div className="px-4 py-3 font-mono">{fmt(Number(d.outstanding))}</div>
                <div className="px-4 py-3 font-mono">{fmt(avail)}</div>
              </Link>
            );})}
          </div></div>
        </div>
      </div>
    </AppShell>
  );
}
