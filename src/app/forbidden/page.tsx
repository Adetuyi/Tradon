export default function Forbidden() {
  return (
    <main className="relative min-h-screen bg-paper flex items-center overflow-hidden">
      {/* Negative accent rule — top of screen */}
      <div className="absolute left-0 top-0 h-1 w-full bg-negative" />

      {/* Giant 403 watermark — bottom-right, very faint */}
      <div
        aria-hidden
        className="absolute -right-16 -bottom-24 font-display font-bold
          text-[300px] leading-none text-ink opacity-[0.035] select-none pointer-events-none"
      >
        403
      </div>

      {/* Content panel */}
      <div className="relative z-10 px-16 max-w-[620px]">
        {/* Wordmark */}
        <div className="font-display font-bold text-xl tracking-tight text-ink mb-10">
          Tradon<span className="text-signal">.</span>
        </div>

        {/* ACCESS RESTRICTED eyebrow */}
        <div className="font-mono text-xs tracking-[0.16em] text-negative uppercase">
          ACCESS RESTRICTED
        </div>

        {/* Display headline */}
        <h1 className="font-display font-bold text-[38px] leading-[1.12] tracking-[-0.025em] text-ink mt-3 mb-3.5">
          This area is outside<br />your permissions.
        </h1>

        {/* Supportive copy */}
        <p className="text-sm text-muted leading-relaxed max-w-[460px]">
          Your role{' '}
          <span className="font-mono text-[12.5px] bg-surface px-2 py-0.5 rounded border border-hairline text-ink">
            Sales
          </span>{' '}
          doesn&apos;t include{' '}
          <span className="font-mono text-[12.5px] bg-surface px-2 py-0.5 rounded border border-hairline text-ink">
            finance.read
          </span>
          . An <strong>Owner</strong> or{' '}
          <strong>Admin</strong> can grant it in Users &amp; Permissions.
        </p>

        {/* Actions */}
        <div className="flex gap-3 mt-7">
          <a
            href="/app"
            className="inline-flex h-11 px-6 rounded-ctl bg-primary text-on-primary
              font-display font-semibold text-sm items-center"
          >
            Back to dashboard
          </a>
          <a
            href="/request-access"
            className="inline-flex h-11 px-6 rounded-ctl bg-surface text-ink
              border border-hairline-strong font-display font-semibold text-sm items-center"
          >
            Request access
          </a>
        </div>
      </div>
    </main>
  );
}
