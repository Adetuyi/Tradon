export default function TenantNotFound() {
  return (
    <main className="relative min-h-[100dvh] bg-paper flex items-center overflow-hidden">
      {/* Top accent rule */}
      <div className="absolute left-0 top-0 h-1 w-full bg-primary" />

      {/* Responsive watermark — bottom-right, never causes scroll */}
      <div
        aria-hidden
        className="absolute -right-6 sm:-right-10 -bottom-10 sm:-bottom-20
          font-display font-bold leading-none tracking-[-0.04em] text-ink
          opacity-[0.035] select-none pointer-events-none
          text-[150px] sm:text-[230px] md:text-[320px]"
      >
        T.
      </div>

      {/* Content */}
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
            className="w-5 h-5 text-primary"
          >
            {/* Compass / broken-link glyph: an open circle with a crossed-out diagonal */}
            <circle cx="12" cy="12" r="9" />
            <path d="M16.5 7.5 9 12l-1.5 4.5 4.5-1.5 7.5-7.5Z" />
            <path d="m7 17 2-2" />
            <line x1="4" y1="4" x2="20" y2="20" strokeDasharray="2 3" />
          </svg>
        </div>

        {/* Eyebrow */}
        <div className="font-mono text-xs tracking-[0.16em] uppercase text-primary">
          NO ACTIVE WORKSPACE
        </div>

        {/* Headline */}
        <h1 className="font-display font-bold text-3xl sm:text-4xl md:text-[44px]
          leading-[1.08] tracking-tight text-ink mt-4 mb-3">
          There&rsquo;s nothing at<br />this address &mdash; yet.
        </h1>

        {/* Body */}
        <p className="text-sm sm:text-base text-muted leading-relaxed max-w-[460px]">
          <span className="font-mono text-[12.5px] bg-surface px-2 py-0.5 rounded border border-hairline text-ink">
            acme.tradon.app
          </span>{' '}
          isn&rsquo;t an active Tradon workspace. The business may not have launched,
          or the link may be mistyped.
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <a
            href="https://tradon.app"
            className="w-full sm:w-auto h-12 px-6 rounded-ctl bg-primary text-on-primary
              font-display font-semibold text-sm inline-flex items-center justify-center
              transition-transform active:translate-y-px hover:opacity-95"
          >
            Visit tradon.app
          </a>
          <a
            href="https://tradon.app/signup"
            className="w-full sm:w-auto h-12 px-6 rounded-ctl bg-surface text-ink
              border border-hairline-strong font-display font-semibold text-sm
              inline-flex items-center justify-center
              transition-transform active:translate-y-px hover:opacity-95"
          >
            Create a workspace
          </a>
        </div>
      </div>
    </main>
  );
}
