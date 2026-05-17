import React from 'react';

export function AuthLayout({
  brandTitle,
  lead,
  sub,
  markers,
  children,
}: {
  brandTitle: string;
  lead: React.ReactNode;
  sub: string;
  markers: string[];
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-[100dvh]">
      {/* Brand panel — desktop only */}
      <aside className="hidden md:flex md:w-[42%] bg-green-900 text-on-deep
        p-11 flex-col relative overflow-hidden brand-panel">
        <div className="relative z-10 flex flex-col h-full">
          <div className="font-display font-bold text-xl text-on-primary">{brandTitle}</div>
          <div className="mt-auto font-display font-bold text-3xl leading-tight text-white">{lead}</div>
          <p className="mt-4 text-sm leading-relaxed max-w-[330px]">{sub}</p>
          <div className="mt-8 pt-[18px] border-t border-white/10 flex gap-6
            font-mono text-[11px] tracking-wide text-on-deep/70">
            {markers.map(m => <span key={m}>{m}</span>)}
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex-1 bg-surface flex items-center justify-center p-6 sm:p-10 md:p-11">
        <div className="w-full max-w-[340px]">
          {/* Mobile-only wordmark — hidden on desktop where brand panel shows */}
          <div className="md:hidden font-display font-bold text-xl text-ink mb-8">
            Tradon<span className="text-signal">.</span>
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}
