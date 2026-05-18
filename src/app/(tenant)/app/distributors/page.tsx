import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { AppShell } from '@/components/ui/AppShell';
import { listDistributors } from '@/lib/distributors/distributors';
import { distributorStats } from '@/lib/distributors/stats';
import { DistributorForm } from './DistributorForm';
import { setStatusAction } from './actions';

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
        <div className="flex items-center justify-between gap-4 mb-5">
          <h1 className="font-display font-bold text-2xl text-ink">Distributors</h1>
          <DistributorForm />
        </div>
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
              <div key={d.id} className="border-t border-hairline">
                <Link href={`/app/distributors/${d.id}`}
                  className="grid grid-cols-[1.8fr_1fr_0.8fr_0.9fr_0.9fr_0.9fr]
                  text-[13px] items-center hover:bg-surface-2">
                  <div className="px-4 py-3 text-ink font-medium">{d.business_name}</div>
                  <div className="px-4 py-3 text-muted">{d.region ?? '—'}</div>
                  <div className="px-4 py-3"><span className={`font-mono text-[10.5px]
                    px-2.5 py-1 rounded-full border ${badge}`}>{d.status}</span></div>
                  <div className="px-4 py-3 font-mono text-muted">{fmt(Number(d.credit_limit))}</div>
                  <div className="px-4 py-3 font-mono">{fmt(Number(d.outstanding))}</div>
                  <div className="px-4 py-3 font-mono">{fmt(avail)}</div>
                </Link>
                {d.status === 'pending' && (
                  <div className="flex gap-2 px-4 pb-3">
                    <form action={setStatusAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="status" value="active" />
                      <button type="submit"
                        className="h-7 px-3 text-xs rounded-ctl bg-primary text-on-primary
                          font-display font-semibold border-transparent inline-flex items-center">
                        Approve
                      </button>
                    </form>
                    <form action={setStatusAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="status" value="archived" />
                      <button type="submit"
                        className="h-7 px-3 text-xs rounded-ctl bg-negative text-white
                          font-display font-semibold border-transparent inline-flex items-center">
                        Reject
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );})}
          </div></div>
        </div>
      </div>
    </AppShell>
  );
}
