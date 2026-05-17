import { supabaseAdmin } from '@/lib/supabase/admin';
import { Input } from '@/components/ui/Input';
import { buttonClass } from '@/components/ui/Button';
import { createTenant } from './actions';

export default async function AdminTenants() {
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('slug,region,created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="flex h-screen bg-paper text-ink">
      {/* Left nav — light inverted shell */}
      <nav className="w-[214px] bg-surface border-r border-hairline p-[22px_14px] flex flex-col flex-shrink-0">
        {/* Wordmark */}
        <div className="font-display font-bold text-xl text-ink px-2">
          Tradon<span className="text-signal">.</span>
        </div>

        {/* PLATFORM chip */}
        <span className="inline-block font-mono text-[10px] tracking-[0.16em] text-signal
          border border-green-200 bg-green-50 px-2.5 py-[3px] rounded-full
          my-[10px] mx-2 w-fit">
          PLATFORM
        </span>

        {/* Nav items */}
        {/* Tenants — active */}
        <div className="flex items-center gap-[11px] text-[13px] px-[11px] py-[9px] rounded-lg
          mb-0.5 bg-green-50 text-primary-700 font-semibold">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
            className="w-[15px] h-[15px] opacity-80 shrink-0">
            <rect x="3" y="4" width="18" height="6" rx="1.5"/>
            <rect x="3" y="14" width="18" height="6" rx="1.5"/>
          </svg>
          Tenants
        </div>

        {/* Domains */}
        <div className="flex items-center gap-[11px] text-[13px] px-[11px] py-[9px] rounded-lg
          mb-0.5 text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
            className="w-[15px] h-[15px] opacity-80 shrink-0">
            <circle cx="12" cy="12" r="9"/>
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>
          </svg>
          Domains
        </div>

        {/* Audit log */}
        <div className="flex items-center gap-[11px] text-[13px] px-[11px] py-[9px] rounded-lg
          mb-0.5 text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
            className="w-[15px] h-[15px] opacity-80 shrink-0">
            <path d="M14 3v5h5M7 3h8l5 5v13H7z"/>
            <path d="M10 13h6M10 17h6"/>
          </svg>
          Audit log
        </div>

        {/* Platform staff */}
        <div className="flex items-center gap-[11px] text-[13px] px-[11px] py-[9px] rounded-lg
          mb-0.5 text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
            className="w-[15px] h-[15px] opacity-80 shrink-0">
            <circle cx="9" cy="7" r="3.5"/>
            <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/>
            <path d="M19 8v6M22 11h-6"/>
          </svg>
          Platform staff
        </div>

        {/* Rail footer */}
        <div className="mt-auto font-mono text-[11px] text-faint
          px-2 pt-[14px] border-t border-hairline">
          superadmin@tradon.app
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-[30px_38px] overflow-hidden">
        {/* Top bar: heading + Superadmin badge */}
        <div className="flex items-baseline justify-between mb-[6px]">
          <h1 className="font-display font-bold text-[22px] text-ink tracking-[-0.02em]">
            Provision a tenant
          </h1>
          <span className="font-mono text-[10px] text-muted border border-hairline
            rounded-full px-2 py-[2px]">
            Superadmin
          </span>
        </div>

        <p className="text-[13px] text-muted mb-[26px] max-w-[520px] leading-[1.6]">
          Creates the workspace, seeds the Owner account, default roles, settings,
          region and the RLS tenant context.
        </p>

        <div className="flex gap-[26px]">
          {/* Provisioning form */}
          <form
            action={createTenant}
            className="flex-none w-[440px] bg-surface border border-hairline
              rounded-card p-[26px] shadow-card"
          >
            {/* Business group */}
            <div className="font-mono text-[10.5px] tracking-[0.1em] text-faint
              uppercase mb-[14px] mt-1">
              Business
            </div>
            <Input label="Business name" name="name" required />
            <Input label="Subdomain" name="slug" suffix=".tradon.app" required />

            {/* Owner & locale group */}
            <div className="font-mono text-[10.5px] tracking-[0.1em] text-faint
              uppercase mt-6 pt-5 border-t border-hairline mb-[14px]">
              Owner &amp; locale
            </div>
            <Input label="Owner user id" name="owner_user_id" required />

            {/* Region + Currency — fixed / display only */}
            <div className="flex gap-3 mb-4">
              <label className="block flex-1">
                <span className="block text-[11px] uppercase tracking-wide text-muted mb-[7px]">
                  Region
                </span>
                <span className="h-[46px] flex items-center justify-between px-3.5 rounded-ctl
                  border border-hairline-strong bg-surface opacity-55">
                  <span className="text-sm text-ink">Nigeria</span>
                  <span className="font-mono text-xs text-muted">NG</span>
                </span>
              </label>
              <label className="block flex-1">
                <span className="block text-[11px] uppercase tracking-wide text-muted mb-[7px]">
                  Currency
                </span>
                <span className="h-[46px] flex items-center justify-between px-3.5 rounded-ctl
                  border border-hairline-strong bg-surface opacity-55">
                  <span className="text-sm text-ink">Naira</span>
                  <span className="font-mono text-xs text-muted">NGN</span>
                </span>
              </label>
            </div>

            {/* Plan — disabled, later milestone */}
            <label className="block mb-5 opacity-55">
              <span className="block text-[11px] uppercase tracking-wide text-muted mb-[7px]">
                Plan{' '}
                <span className="inline-block font-mono text-[10px] text-muted
                  border border-hairline rounded-full px-2 py-[2px] ml-1 normal-case tracking-normal">
                  billing · later milestone
                </span>
              </span>
              <span className="h-[46px] flex items-center px-3.5 rounded-ctl
                border border-hairline-strong bg-surface text-sm text-muted">
                —
              </span>
            </label>

            <button type="submit" className={`w-full ${buttonClass('primary')}`}>
              Provision tenant
            </button>
          </form>

          {/* Active tenants table */}
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-[13px] text-ink mb-[14px]">
              Active tenants
            </div>
            <div className="border border-hairline rounded-card overflow-hidden bg-surface">
              {/* Header row */}
              <div className="grid grid-cols-3 bg-surface-2 text-[10.5px] uppercase
                tracking-[0.05em] text-muted font-semibold">
                <div className="px-4 py-[13px]">Workspace</div>
                <div className="px-4 py-[13px]">Region</div>
                <div className="px-4 py-[13px]">Created</div>
              </div>
              {/* Data rows */}
              {(tenants ?? []).map(t => (
                <div
                  key={t.slug}
                  className="grid grid-cols-3 text-[12.5px] border-t border-hairline"
                >
                  <div className="px-4 py-[13px]">{t.slug}.tradon.app</div>
                  <div className="px-4 py-[13px]">{t.region}</div>
                  <div className="px-4 py-[13px] font-mono text-muted">
                    {new Date(t.created_at).toISOString().slice(0, 10)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
