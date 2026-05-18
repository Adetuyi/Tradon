'use client';
import { setStatusAction } from './actions';
import { buttonClass } from '@/components/ui/Button';

const NEXT: Record<string, { to: string; label: string; tone: 'primary' | 'secondary' | 'danger' }[]> = {
  pending: [
    { to: 'active', label: 'Approve', tone: 'primary' },
    { to: 'archived', label: 'Reject', tone: 'danger' },
  ],
  active: [
    { to: 'suspended', label: 'Suspend', tone: 'secondary' },
    { to: 'archived', label: 'Archive', tone: 'danger' },
  ],
  suspended: [
    { to: 'active', label: 'Reactivate', tone: 'primary' },
    { to: 'archived', label: 'Archive', tone: 'danger' },
  ],
  archived: [],
};

export function StatusActions({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {(NEXT[status] ?? []).map(a => (
        <form key={a.to} action={setStatusAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={a.to} />
          <button type="submit" className={`h-9 px-4 text-xs ${buttonClass(a.tone)}`}>
            {a.label}
          </button>
        </form>
      ))}
    </div>
  );
}
