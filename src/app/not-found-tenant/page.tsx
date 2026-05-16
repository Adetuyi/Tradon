export default function TenantNotFound() {
  return (
    <main className="relative min-h-screen bg-paper flex items-center overflow-hidden">
      {/* Accent rule */}
      <div className="absolute left-0 top-0 h-1 w-full bg-primary" />

      {/* Giant watermark */}
      <div
        aria-hidden
        className="absolute -right-16 -bottom-24 font-display font-bold
          text-[300px] leading-none tracking-[-0.04em] text-ink opacity-[0.035] select-none"
      >
        T.
      </div>

      {/* Content */}
      <div className="relative z-10 px-16 max-w-[620px]">
        {/* Wordmark */}
        <div className="font-display font-bold text-xl tracking-tight text-ink mb-10">
          Tradon<span className="text-signal">.</span>
        </div>

        {/* Eyebrow */}
        <div className="font-mono text-xs tracking-[0.16em] uppercase text-primary">
          NO ACTIVE WORKSPACE
        </div>

        {/* Headline */}
        <h1 className="font-display font-bold text-[38px] leading-[1.12] tracking-[-0.025em] text-ink mt-3 mb-3.5">
          There&rsquo;s nothing at<br />this address &mdash; yet.
        </h1>

        {/* Body */}
        <p className="text-sm text-muted leading-relaxed max-w-[460px]">
          This isn&rsquo;t an active Tradon workspace. The business may not have launched,
          or the link may be mistyped.
        </p>

        {/* Actions */}
        <div className="mt-7 flex gap-3">
          <a
            href="https://tradon.app"
            className="h-11 px-6 rounded-ctl bg-primary text-on-primary
              font-display font-semibold text-sm flex items-center"
          >
            Visit tradon.app
          </a>
          <a
            href="https://tradon.app/signup"
            className="h-11 px-6 rounded-ctl bg-surface text-ink border border-hairline-strong
              font-display font-semibold text-sm flex items-center"
          >
            Create a workspace
          </a>
        </div>
      </div>
    </main>
  );
}
