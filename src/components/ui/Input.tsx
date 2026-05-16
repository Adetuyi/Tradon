import React from 'react';

export function Input({
  label,
  suffix,
  ...p
}: { label: string; suffix?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block mb-4">
      <span className="block text-[11px] uppercase tracking-wide text-muted mb-[7px]">
        {label}
      </span>
      <span
        className="h-[46px] flex items-center justify-between px-3.5 rounded-ctl
        border border-hairline-strong bg-surface focus-within:border-primary
        focus-within:ring-2 focus-within:ring-green-50"
      >
        <input className="bg-transparent outline-none w-full text-sm text-ink" {...p} />
        {suffix && <span className="font-mono text-xs text-muted">{suffix}</span>}
      </span>
    </label>
  );
}
