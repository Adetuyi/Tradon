import React from 'react';

type V = 'primary' | 'secondary' | 'ghost' | 'danger';

export function buttonClass(v: V): string {
  const base =
    'h-[46px] rounded-ctl inline-flex items-center justify-center ' +
    'font-display font-semibold text-sm px-5 gap-2 border';
  const map: Record<V, string> = {
    primary: 'bg-primary text-on-primary border-transparent',
    secondary: 'bg-surface text-ink border-hairline-strong',
    ghost: 'bg-transparent text-primary border-transparent',
    danger: 'bg-negative text-white border-transparent',
  };
  return `${base} ${map[v]}`;
}

export function Button({
  variant = 'primary',
  children,
}: {
  variant?: V;
  children: React.ReactNode;
}) {
  return <button className={buttonClass(variant)}>{children}</button>;
}
