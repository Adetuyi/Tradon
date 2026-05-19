'use client';
import { confirmOrderAction, fulfillOrderAction, cancelOrderAction,
  returnOrderAction } from './actions';
import { buttonClass } from '@/components/ui/Button';

type Act = { action: (fd: FormData) => void; label: string;
  tone: 'primary' | 'secondary' | 'danger' };

const NEXT: Record<string, Act[]> = {
  draft: [{ action: confirmOrderAction, label: 'Confirm', tone: 'primary' }],
  confirmed: [
    { action: fulfillOrderAction, label: 'Fulfill', tone: 'primary' },
    { action: returnOrderAction, label: 'Return', tone: 'secondary' },
    { action: cancelOrderAction, label: 'Cancel', tone: 'danger' },
  ],
  fulfilled: [
    { action: returnOrderAction, label: 'Return', tone: 'secondary' },
  ],
  cancelled: [],
  returned: [],
};

export function LifecycleActions({ id, status }:
  { id: string; status: string }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {(NEXT[status] ?? []).map(a => (
        <form key={a.label} action={a.action}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={`h-9 px-4 text-xs ${buttonClass(a.tone)}`}>
            {a.label}
          </button>
        </form>
      ))}
    </div>
  );
}
