'use client';
import { useState } from 'react';
import { setCreditLimitAction, recordCreditAction } from './actions';
import { buttonClass } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function CreditPanel({ id }: { id: string }) {
  const [dir, setDir] = useState<'add' | 'subtract'>('add');
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <form action={setCreditLimitAction} className="bg-surface border border-hairline rounded-card p-5">
        <input type="hidden" name="id" value={id} />
        <div className="font-display font-semibold text-sm text-ink mb-3">Set credit limit</div>
        <Input label="New limit (₦)" name="creditLimit" type="number" step="0.01" required />
        <button type="submit" className={`w-full ${buttonClass('primary')}`}>Update limit</button>
      </form>
      <form action={recordCreditAction} className="bg-surface border border-hairline rounded-card p-5">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="direction" value={dir} />
        <div className="font-display font-semibold text-sm text-ink mb-3">Record credit movement</div>
        <label className="block mb-4">
          <span className="block text-[11px] uppercase tracking-wide text-muted mb-[7px]">Type</span>
          <select
            name="type"
            className="h-[46px] w-full rounded-ctl border border-hairline-strong
              bg-surface px-3 text-sm text-ink"
          >
            <option value="repayment">Repayment</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </label>
        <div className="mb-4">
          <span className="block text-[11px] uppercase tracking-wide text-muted mb-[7px]">Amount (₦)</span>
          <div className="flex gap-2.5">
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              className="flex-1 h-[46px] rounded-ctl border border-hairline-strong
                bg-surface px-3 text-sm text-ink"
            />
            <div className="flex rounded-ctl border border-hairline-strong overflow-hidden shrink-0">
              {(['add', 'subtract'] as const).map((dd, i) => (
                <button
                  type="button"
                  key={dd}
                  onClick={() => setDir(dd)}
                  className={`px-4 font-display font-semibold text-[12.5px] ${
                    i === 1 ? 'border-l border-hairline-strong' : ''
                  } ${dir === dd ? 'bg-primary text-on-primary' : 'bg-surface text-muted'}`}
                >
                  {dd === 'add' ? 'Add' : 'Subtract'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-faint mt-1">
            Repayment reduces outstanding; Add/Subtract applies to Adjustment. Purchase draws come
            from Orders.
          </p>
        </div>
        <Input label="Reason" name="reason" />
        <button type="submit" className={`w-full ${buttonClass('primary')}`}>Record</button>
      </form>
    </div>
  );
}
