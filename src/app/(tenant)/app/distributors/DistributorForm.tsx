'use client';
import { useState } from 'react';
import { createDistributorAction } from './actions';
import { buttonClass } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function DistributorForm() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={buttonClass('primary')}>
        + New distributor
      </button>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 flex items-start justify-center
            p-0 sm:p-7 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface w-full sm:max-w-[420px] rounded-t-card sm:rounded-card
              p-6 max-h-[100dvh] sm:max-h-[92dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-display font-bold text-lg text-ink mb-1">New distributor</h3>
            <p className="text-xs text-muted mb-4">
              Creates a pending distributor and a shop account shell (the distributor sets a
              password later, in the shop).
            </p>
            <form action={createDistributorAction}>
              <Input label="Business name" name="businessName" required />
              <Input label="Contact name" name="contactName" required />
              <Input label="Contact email" name="email" type="email" required />
              <Input label="Region" name="region" />
              <Input
                label="Credit limit (₦)"
                name="creditLimit"
                type="number"
                step="0.01"
                defaultValue="0"
              />
              <button type="submit" className={`w-full ${buttonClass('primary')}`}>
                Create distributor
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
