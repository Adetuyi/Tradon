export default function Forbidden() {
  return (
    <main className="relative min-h-[100dvh] bg-paper flex items-center overflow-hidden">
      {/* Top accent rule */}
      <div className="absolute left-0 top-0 h-1 w-full bg-negative" />

      {/* Responsive watermark — bottom-right, never causes scroll */}
      <div
        aria-hidden
        className="absolute -right-6 sm:-right-10 -bottom-10 sm:-bottom-20
          font-display font-bold leading-none text-ink
          opacity-[0.035] select-none pointer-events-none
          text-[150px] sm:text-[230px] md:text-[320px]"
      >
        403
      </div>

      {/* Content panel */}
      <div className="relative z-10 w-full max-w-[620px] mx-auto px-5 sm:px-8 md:px-16 py-20">
        {/* Wordmark */}
        <div className="font-display font-bold text-xl tracking-tight text-ink mb-8 sm:mb-10">
          Tradon<span className="text-signal">.</span>
        </div>

        {/* Composed mark */}
        <div className="size-12 rounded-card border border-hairline bg-surface flex items-center justify-center mb-5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 text-negative"
          >
            {/* Shield / lock glyph */}
            <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6Z" />
            <rect x="9" y="11" width="6" height="5" rx="1" />
            <path d="M12 11V8.5a1.5 1.5 0 0 0-3 0V11" />
          </svg>
        </div>

        {/* ACCESS RESTRICTED eyebrow */}
        <div className="font-mono text-xs tracking-[0.16em] text-negative uppercase">
          ACCESS RESTRICTED
        </div>

        {/* Display headline */}
        <h1 className="font-display font-bold text-3xl sm:text-4xl md:text-[44px]
          leading-[1.08] tracking-tight text-ink mt-4 mb-3">
          This area is outside<br />your permissions.
        </h1>

        {/* Supportive copy */}
        <p className="text-sm sm:text-base text-muted leading-relaxed max-w-[460px]">
          Your role{' '}
          <span className="font-mono text-[12.5px] bg-surface px-2 py-0.5 rounded border border-hairline text-ink">
            Sales
          </span>{' '}
          doesn&apos;t include{' '}
          <span className="font-mono text-[12.5px] bg-surface px-2 py-0.5 rounded border border-hairline text-ink">
            finance.read
          </span>
          . An Owner or Admin can grant it in Users &amp; Permissions.
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <a
            href="/app"
            className="w-full sm:w-auto h-12 px-6 rounded-ctl bg-primary text-on-primary
              font-display font-semibold text-sm inline-flex items-center justify-center
              transition-transform active:translate-y-px hover:opacity-95"
          >
            Back to dashboard
          </a>
          <a
            href="/request-access"
            className="w-full sm:w-auto h-12 px-6 rounded-ctl bg-surface text-ink
              border border-hairline-strong font-display font-semibold text-sm
              inline-flex items-center justify-center
              transition-transform active:translate-y-px hover:opacity-95"
          >
            Request access
          </a>
        </div>
      </div>
    </main>
  );
}
