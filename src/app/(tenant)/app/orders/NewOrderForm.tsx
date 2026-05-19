'use client';
import { useState } from 'react';
import { createOrderAction } from './actions';
import { buttonClass } from '@/components/ui/Button';

type Customer = { id: string; full_name: string };
type Dist = { id: string; business_name: string };
type Prod = { id: string; name: string; selling_price: string; cost_price: string };
type Line = { productId: string; quantity: number; unitPrice: number; unitCost: number };

export function NewOrderForm({ customers, distributors, products }:
  { customers: Customer[]; distributors: Dist[]; products: Prod[] }) {
  const [open, setOpen] = useState(false);
  const [external, setExternal] = useState(false);
  const [onCredit, setOnCredit] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);

  const addLine = () => {
    const p = products[0];
    if (!p) return;
    setLines(l => [...l, { productId: p.id, quantity: 1,
      unitPrice: Number(p.selling_price), unitCost: Number(p.cost_price) }]);
  };
  const setLine = (i: number, patch: Partial<Line>) =>
    setLines(l => l.map((x, j) => j === i ? { ...x, ...patch } : x));
  const removeLine = (i: number) =>
    setLines(l => l.filter((_, j) => j !== i));
  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const inputCls = 'h-[42px] w-full px-3 rounded-ctl border border-hairline-strong ' +
    'bg-surface text-sm text-ink outline-none focus:border-primary';
  const labelCls = 'block text-[11px] uppercase tracking-wide text-muted mb-1.5 mt-3';

  return (
    <>
      <button onClick={() => setOpen(true)} className={buttonClass('primary')}>
        + New order
      </button>
      {open && (
        <div className="fixed inset-0 z-40 bg-ink/30 flex items-start justify-center
          p-0 sm:p-7 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-surface w-full sm:max-w-[480px] rounded-t-card sm:rounded-card
            p-6 max-h-[100dvh] sm:max-h-[92dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg text-ink mb-1">New order</h3>
            <p className="text-xs text-muted mb-4">
              Pick the customer and add product lines (price prefilled from the product,
              editable). Optionally bill a distributor on credit.</p>

            <form action={createOrderAction}>
              <div className="flex border border-hairline-strong rounded-ctl overflow-hidden mb-2">
                {[['Platform · draft', false], ['Log external · confirmed', true]]
                  .map(([lbl, ext]) => (
                  <button type="button" key={lbl as string}
                    onClick={() => setExternal(ext as boolean)}
                    className={`flex-1 py-2.5 text-xs font-display font-semibold ${
                      external === ext ? 'bg-primary text-on-primary'
                        : 'text-muted'}`}>{lbl}</button>
                ))}
              </div>
              <p className="text-[11px] text-faint mb-3">
                {external ? 'Creates a confirmed order immediately (stock decrements now).'
                  : 'Saved as a draft — no stock/credit effect until confirmed.'}</p>
              <input type="hidden" name="channel" value={external ? 'external' : 'platform'} />

              <label className={labelCls}>Customer</label>
              <select name="shopUserId" required className={inputCls}>
                {customers.map(c =>
                  <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>

              <label className="flex items-center gap-2 mt-4 text-sm text-ink">
                <input type="checkbox" checked={onCredit}
                  onChange={e => setOnCredit(e.target.checked)} />
                Bill to a distributor on credit
              </label>

              {onCredit && (
                <>
                  <label className={labelCls}>Distributor (active only)</label>
                  <select name="distributorId" className={inputCls}>
                    {distributors.map(d =>
                      <option key={d.id} value={d.id}>{d.business_name}</option>)}
                  </select>
                </>
              )}
              <input type="hidden" name="paymentMethod"
                value={onCredit ? 'credit' : 'paid'} />

              <label className={labelCls}>Line items</label>
              <div className="border border-dashed border-hairline-strong rounded-ctl p-3">
                {lines.length === 0 && (
                  <p className="text-xs text-muted text-center py-2">
                    No lines yet.</p>)}
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1.6fr_0.5fr_0.8fr_auto]
                    gap-2 items-center mb-2">
                    <select className={inputCls} value={l.productId}
                      onChange={e => {
                        const p = products.find(x => x.id === e.target.value)!;
                        setLine(i, { productId: p.id,
                          unitPrice: Number(p.selling_price),
                          unitCost: Number(p.cost_price) });
                      }}>
                      {products.map(p =>
                        <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" min="1" className={inputCls}
                      value={l.quantity}
                      onChange={e => setLine(i, {
                        quantity: Math.max(1, Number(e.target.value)) })} />
                    <input type="number" min="0" step="0.01" className={inputCls}
                      value={l.unitPrice}
                      onChange={e => setLine(i, {
                        unitPrice: Number(e.target.value) })} />
                    <button type="button" onClick={() => removeLine(i)}
                      className="text-negative text-xs px-1">✕</button>
                  </div>
                ))}
                <button type="button" onClick={addLine}
                  className="text-xs text-signal font-semibold mt-1">
                  + Add product line</button>
              </div>

              <input type="hidden" name="lines" value={JSON.stringify(lines)} />

              <div className="flex justify-between items-center mt-4 mb-4
                bg-surface-2 border border-hairline rounded-ctl px-4 py-3">
                <span className="text-[11px] uppercase tracking-wide text-muted">
                  Order total</span>
                <span className="font-display font-bold text-ink font-mono">
                  ₦{total.toLocaleString('en-NG')}</span>
              </div>

              <button type="submit"
                disabled={lines.length === 0}
                className={`w-full ${buttonClass('primary')}
                  ${lines.length === 0 ? 'opacity-50' : ''}`}>
                {external ? 'Log external order' : 'Save draft'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
