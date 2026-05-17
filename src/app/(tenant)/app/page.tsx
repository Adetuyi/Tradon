import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { AppShell } from '@/components/ui/AppShell';

const CHECKS: [string, string][] = [
  ['Tenant resolved', 'active'],
  ['Signed in', 'staff'],
  ['Data isolation', 'RLS enforced'],
  ['Audit trail', 'recording'],
];

export default async function AppHome() {
  const tenant = await resolveTenant((await headers()).get('host') ?? '');
  if (!tenant) redirect('/not-found-tenant');
  const session = await getStaffSession(tenant.id);
  if (!session) redirect('/login');
  const principal = session.membership
    ? { role: session.membership.role, isPlatform: false }
    : null;
  await requirePermission(principal, 'dashboard.read');

  return (
    <AppShell tenantName={tenant.slug} role={session.membership!.role}>
      <div className="w-[560px] bg-surface border border-hairline rounded-card p-[34px_36px] shadow-card">
        {/* Eyebrow */}
        <div className="font-mono text-[11px] tracking-[0.14em] text-signal">
          PLATFORM FOUNDATION · F0
        </div>

        {/* Heading */}
        <h2 className="font-display font-bold text-[22px] text-ink mt-[9px] tracking-[-0.02em]">
          Your workspace is live.
        </h2>

        {/* Body */}
        <p className="text-[13px] text-muted mt-[7px] leading-relaxed max-w-[430px]">
          Tenancy, authentication, role-based access and data isolation are
          running. Feature modules arrive in the next milestones — the
          groundwork they stand on is done.
        </p>

        {/* Checklist */}
        <div className="mt-6 grid gap-px bg-hairline border border-hairline rounded-[10px] overflow-hidden">
          {CHECKS.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center gap-3 bg-surface px-4 py-[13px] text-[13px]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-[17px] h-[17px] text-positive shrink-0"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span className="text-ink">{label}</span>
              <span className="ml-auto font-mono text-[12px] text-muted">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
