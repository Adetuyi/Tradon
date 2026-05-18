import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { AppShell } from '@/components/ui/AppShell';
import { getDistributor, getDistributorContact } from '@/lib/distributors/distributors';
import { listCreditMovements } from '@/lib/distributors/credit';
import { listDistributorActivity } from '@/lib/distributors/activity';
import { StatusActions } from '../StatusActions';
import { CreditPanel } from '../CreditPanel';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'credit', label: 'Credit' },
  { key: 'activity', label: 'Activity' },
  { key: 'orders', label: 'Orders', deferred: true },
] as const;

function statusBadgeClass(status: string): string {
  if (status === 'active') return 'bg-green-50 text-primary-700 border-green-200';
  if (status === 'pending') return 'bg-surface-2 text-signal border-hairline';
  if (status === 'suspended') return 'bg-surface-2 text-negative border-hairline';
  return 'bg-surface-2 text-muted border-hairline';
}

function fmt(n: number): string {
  return '₦' + n.toLocaleString('en-NG');
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default async function DistributorDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = 'overview' } = await searchParams;

  const tenant = await resolveTenant((await headers()).get('host') ?? '');
  if (!tenant) redirect('/not-found-tenant');
  const session = await getStaffSession(tenant.id);
  if (!session) redirect('/login');
  const principal = session.membership
    ? { role: session.membership.role, isPlatform: false }
    : null;
  await requirePermission(principal, 'distributors.read');

  const d = await getDistributor(tenant.id, id);
  if (!d) notFound();

  const contact = await getDistributorContact(tenant.id, d.shop_user_id);

  const avail = Number(d.credit_limit) - Number(d.outstanding);

  const [movements, activityRows] = await Promise.all([
    tab === 'credit' ? listCreditMovements(tenant.id, id) : Promise.resolve(null),
    tab === 'activity' ? listDistributorActivity(tenant.id, id) : Promise.resolve(null),
  ]);

  return (
    <AppShell tenantName={tenant.slug} role={session.membership!.role}>
      <div className="w-full max-w-[1100px]">

        {/* Back link */}
        <Link
          href="/app/distributors"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink mb-4"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            className="w-3.5 h-3.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Distributors
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display font-bold text-2xl text-ink">
                {d.business_name}
              </h1>
              <span className={`font-mono text-[10.5px] px-2.5 py-1 rounded-full border
                ${statusBadgeClass(d.status)}`}>
                {d.status}
              </span>
            </div>
            {d.region && (
              <p className="text-sm text-muted mt-1">{d.region}</p>
            )}
          </div>
          <StatusActions id={d.id} status={d.status} />
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-hairline mb-6 gap-0 overflow-x-auto">
          {TABS.map(t => {
            const isActive = tab === t.key;
            if ('deferred' in t && t.deferred) {
              return (
                <span
                  key={t.key}
                  className="px-4 py-2.5 text-[13px] font-display font-medium text-muted/50
                    cursor-not-allowed select-none whitespace-nowrap"
                  title="Coming soon"
                >
                  {t.label}
                  <span className="ml-1.5 font-mono text-[10px] bg-surface-2 border border-hairline
                    text-muted px-1.5 py-0.5 rounded-full align-middle">soon</span>
                </span>
              );
            }
            return (
              <Link
                key={t.key}
                href={`?tab=${t.key}`}
                className={`px-4 py-2.5 text-[13px] font-display font-medium whitespace-nowrap
                  border-b-2 -mb-px transition-colors ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted hover:text-ink'
                  }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {/* ── Overview tab ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Credit summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Credit limit', value: fmt(Number(d.credit_limit)) },
                { label: 'Outstanding', value: fmt(Number(d.outstanding)), warn: Number(d.outstanding) > Number(d.credit_limit) },
                { label: 'Available', value: fmt(avail), warn: avail < 0 },
              ].map(card => (
                <div
                  key={card.label}
                  className="bg-surface border border-hairline rounded-card p-5"
                >
                  <div className="text-[11px] uppercase tracking-wide text-muted">
                    {card.label}
                  </div>
                  <div className={`font-display font-bold text-2xl mt-2 font-mono ${
                    card.warn ? 'text-negative' : 'text-ink'
                  }`}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Details grid */}
            <div className="bg-surface border border-hairline rounded-card p-5">
              <div className="font-display font-semibold text-sm text-ink mb-4">Details</div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {[
                  { term: 'Business name', val: d.business_name },
                  {
                    term: 'Contact',
                    val: contact
                      ? `${contact.full_name} · ${contact.email}`
                      : '—',
                  },
                  { term: 'Region', val: d.region ?? '—' },
                  { term: 'Address', val: d.address ?? '—' },
                  {
                    term: 'Status',
                    val: null,
                    badge: d.status,
                  },
                ].map(row => (
                  <div key={row.term} className="flex flex-col gap-0.5">
                    <dt className="text-[11px] uppercase tracking-wide text-muted">{row.term}</dt>
                    {row.badge ? (
                      <dd>
                        <span className={`font-mono text-[10.5px] px-2.5 py-1 rounded-full border
                          ${statusBadgeClass(row.badge)}`}>
                          {row.badge}
                        </span>
                      </dd>
                    ) : (
                      <dd className="text-sm text-ink">{row.val}</dd>
                    )}
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}

        {/* ── Credit tab ── */}
        {tab === 'credit' && (
          <div className="space-y-6">
            <CreditPanel id={d.id} />

            {/* Credit movements ledger */}
            <div className="bg-surface border border-hairline rounded-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-hairline font-display font-semibold
                text-sm text-ink">
                Credit movements
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1.2fr] bg-surface-2
                    text-[10.5px] uppercase tracking-wide text-muted font-semibold">
                    {['Movement', 'Amount', 'Actor', 'When'].map(h => (
                      <div key={h} className="px-4 py-3">{h}</div>
                    ))}
                  </div>
                  {(!movements || movements.length === 0) && (
                    <div className="px-4 py-12 text-center text-muted text-sm">
                      No credit movements yet.
                    </div>
                  )}
                  {movements && movements.map(m => {
                    const delta = Number(m.delta);
                    const isNegative = delta < 0; // repayment reduces outstanding — positive for distributor
                    return (
                      <div
                        key={m.id}
                        className="grid grid-cols-[2fr_1fr_1fr_1.2fr] border-t border-hairline
                          text-[13px] items-center"
                      >
                        <div className="px-4 py-3 text-ink">
                          <span className="capitalize">{m.type}</span>
                          {m.reason && (
                            <span className="text-muted"> · {m.reason}</span>
                          )}
                        </div>
                        <div className={`px-4 py-3 font-mono font-semibold ${
                          isNegative ? 'text-positive' : 'text-negative'
                        }`}>
                          {isNegative ? '' : '+'}{fmt(delta)}
                        </div>
                        <div className="px-4 py-3 text-muted font-mono text-xs">{m.actor}</div>
                        <div className="px-4 py-3 text-muted text-xs">
                          {fmtDateTime(m.created_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Activity tab ── */}
        {tab === 'activity' && (
          <div className="space-y-4">
            <div className="bg-surface border border-hairline rounded-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-hairline font-display font-semibold
                text-sm text-ink">
                Activity log
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-[1.5fr_2fr_1.5fr] bg-surface-2
                    text-[10.5px] uppercase tracking-wide text-muted font-semibold">
                    {['Action', 'Change', 'Actor · When'].map(h => (
                      <div key={h} className="px-4 py-3">{h}</div>
                    ))}
                  </div>
                  {(!activityRows || activityRows.length === 0) && (
                    <div className="px-4 py-12 text-center text-muted text-sm">
                      No activity recorded yet.
                    </div>
                  )}
                  {activityRows && activityRows.map((entry, i) => {
                    const meta = entry.meta as Record<string, unknown>;
                    let changeStr: string;
                    if (meta.old !== undefined && meta.new !== undefined) {
                      changeStr = `${String(meta.old)} → ${String(meta.new)}`;
                    } else {
                      const keys = Object.keys(meta);
                      changeStr = keys.length === 0
                        ? '—'
                        : keys.map(k => `${k}: ${String(meta[k])}`).join(', ');
                    }
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-[1.5fr_2fr_1.5fr] border-t border-hairline
                          text-[13px] items-start py-1"
                      >
                        <div className="px-4 py-2.5 font-mono text-xs text-ink">{entry.action}</div>
                        <div className="px-4 py-2.5 text-sm text-muted">{changeStr}</div>
                        <div className="px-4 py-2.5 text-xs text-muted">
                          <span className="font-mono">{entry.actor}</span>
                          <span className="block text-faint text-[11px] mt-0.5">
                            {fmtDateTime(entry.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-faint px-1">
              Actor shown as staff user-id; friendly-name resolution is a later follow-up.
            </p>
          </div>
        )}

        {/* ── Orders tab (deferred) ── */}
        {tab === 'orders' && (
          <div className="bg-surface border border-hairline rounded-card p-10 text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"
              className="w-10 h-10 text-muted mx-auto mb-3">
              <path d="M21 8 12 3 3 8l9 5 9-5Z" />
              <path d="M3 8v8l9 5 9-5V8" />
              <path d="M12 13v8" />
            </svg>
            <div className="font-display font-semibold text-sm text-ink mb-1">
              Order history coming soon
            </div>
            <p className="text-xs text-muted max-w-[340px] mx-auto">
              Distributor order history arrives with the Orders sub-project.
            </p>
          </div>
        )}

      </div>
    </AppShell>
  );
}
