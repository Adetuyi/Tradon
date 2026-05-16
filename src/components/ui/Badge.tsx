import React from 'react';

type T = 'owner' | 'role' | 'pos' | 'neg' | 'sig';

const C: Record<T, string> = {
  owner: 'bg-primary text-white border-primary',
  role: 'bg-green-50 text-primary-700 border-green-200',
  pos: 'bg-green-50 text-positive border-green-200',
  neg: 'bg-surface-2 text-negative border-hairline',
  sig: 'bg-surface-2 text-signal border-hairline',
};

export function Badge({
  tone = 'role',
  children,
}: {
  tone?: T;
  children: React.ReactNode;
}) {
  return (
    <span className={`font-mono text-[11px] px-[11px] py-1 rounded-full border ${C[tone]}`}>
      {children}
    </span>
  );
}
