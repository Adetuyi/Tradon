import React from 'react';

type T = 'pos' | 'neg' | 'sig';

const C: Record<T, string> = {
  pos: 'bg-green-50 border-green-200 text-positive',
  neg: 'bg-surface-2 border-hairline text-negative',
  sig: 'bg-surface-2 border-hairline text-signal',
};

export function Alert({
  tone = 'pos',
  children,
}: {
  tone?: T;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex gap-2.5 p-3.5 rounded-ctl border text-xs ${C[tone]}`}>{children}</div>
  );
}
