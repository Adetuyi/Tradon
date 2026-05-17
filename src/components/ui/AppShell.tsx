import React from 'react';

const NAV: { label: string; icon: React.ReactNode }[] = [
  {
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 shrink-0 opacity-85">
        <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
  },
  {
    label: 'Distributors',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 shrink-0 opacity-85">
        <circle cx="9" cy="7" r="3.5" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
      </svg>
    ),
  },
  {
    label: 'Products',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 shrink-0 opacity-85">
        <path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" />
      </svg>
    ),
  },
  {
    label: 'Orders',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 shrink-0 opacity-85">
        <circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
        <path d="M2 3h3l2.4 12h11" />
      </svg>
    ),
  },
  {
    label: 'Finance',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 shrink-0 opacity-85">
        <rect x="2" y="6" width="20" height="13" rx="2" /><circle cx="12" cy="12.5" r="2.4" />
      </svg>
    ),
  },
  {
    label: 'Reporting',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 shrink-0 opacity-85">
        <path d="M3 3v18h18" /><path d="M7 14l3-4 3 3 5-7" />
      </svg>
    ),
  },
  {
    label: 'Promos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 shrink-0 opacity-85">
        <path d="M20 12 12 4H4v8l8 8Z" /><circle cx="7.5" cy="7.5" r="1.2" />
      </svg>
    ),
  },
  {
    label: 'Billing & Pricing',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 shrink-0 opacity-85">
        <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
      </svg>
    ),
  },
  {
    label: 'Users & Permissions',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 shrink-0 opacity-85">
        <circle cx="9" cy="7" r="3.5" />
        <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
        <path d="M19 8v6M22 11h-6" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 shrink-0 opacity-85">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.6 1.6 0 0 0-2.7 1.1 2 2 0 1 1-4 0 1.6 1.6 0 0 0-2.7-1.1 2 2 0 1 1-2.8-2.8A1.6 1.6 0 0 0 4.6 14a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.1-2.7 2 2 0 1 1 2.8-2.8A1.6 1.6 0 0 0 11 4.6a2 2 0 1 1 4 0 1.6 1.6 0 0 0 2.7 1.1 2 2 0 1 1 2.8 2.8 1.6 1.6 0 0 0 1 2.9Z" />
      </svg>
    ),
  },
];

export function AppShell({
  tenantName,
  role,
  children,
}: {
  tenantName: string;
  role: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-paper text-ink">
      {/* Sidebar */}
      <nav className="w-[218px] bg-green-900 text-on-deep p-[22px_14px] flex flex-col shrink-0">
        {/* Wordmark */}
        <div className="font-display font-bold text-xl text-on-primary px-2 pb-6">
          Tradon<span className="text-signal">.</span>
        </div>

        {/* Nav items */}
        {NAV.map((item, i) => (
          <div
            key={item.label}
            className={[
              'flex items-center gap-3 px-[11px] py-[9px] rounded-lg text-[13px] mb-0.5',
              i === 0
                ? 'bg-primary-700 text-on-primary font-semibold'
                : 'text-on-deep/80',
            ].join(' ')}
          >
            {item.icon}
            {item.label}
          </div>
        ))}

        {/* Sidebar footer */}
        <div className="mt-auto pt-[14px] border-t border-white/[0.08] text-[11px] text-on-deep/60 px-2">
          {tenantName}.tradon.app · Lagos · NGN
        </div>
      </nav>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-[62px] border-b border-hairline flex items-center justify-between px-[26px] bg-surface shrink-0">
          {/* Crumb */}
          <div className="text-[13px] text-muted">
            <b className="text-ink font-display font-semibold">{tenantName}</b>
            {' · '}
            Dashboard
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-[14px]">
            {/* Search pill */}
            <div className="flex items-center gap-2 bg-surface-2 border border-hairline rounded-full px-[14px] py-2 text-[12px] text-muted">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              Search
            </div>

            {/* Role badge */}
            <span className="font-mono text-[11px] bg-green-50 text-primary-700 border border-green-200 px-[10px] py-1 rounded-full">
              role · {role}
            </span>

            {/* Avatar */}
            <div className="w-[34px] h-[34px] rounded-full bg-primary text-on-primary flex items-center justify-center font-display font-semibold text-[12px]">
              OA
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 p-[42px] flex items-center justify-center bg-paper overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
