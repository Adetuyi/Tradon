'use client';
import { useState } from 'react';
import { adjustStockAction, recentMovementsAction } from './actions';
import { buttonClass } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Mv = { id:string; type:string; qty_delta:number; reason:string|null; created_at:string };

export function StockAdjust({ productId, name }: { productId:string; name:string }) {
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<'add'|'subtract'>('add');
  const [hist, setHist] = useState<Mv[]>([]);
  async function openDrawer() {
    setOpen(true);
    try { setHist(await recentMovementsAction(productId) as Mv[]); } catch { setHist([]); }
  }
  return (
    <>
      <button onClick={openDrawer} className="text-xs text-signal font-medium">Adjust</button>
      {open && (
        <div className="fixed inset-0 z-40 bg-ink/30 flex items-start justify-center
          p-0 sm:p-7 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-surface w-full sm:max-w-[400px] rounded-t-card sm:rounded-card
            p-6 max-h-[100dvh] sm:max-h-[92dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg text-ink">Adjust stock</h3>
            <p className="text-xs text-muted mb-4">{name}</p>
            <form action={adjustStockAction}>
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="direction" value={dir} />
              <label className="block mb-4">
                <span className="block text-[11px] uppercase tracking-wide text-muted mb-[7px]">
                  Type</span>
                <select name="type" className="h-[46px] w-full rounded-ctl
                  border border-hairline-strong bg-surface px-3 text-sm text-ink">
                  <option value="receipt">Receipt</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </label>
              <div className="mb-4">
                <span className="block text-[11px] uppercase tracking-wide text-muted mb-[7px]">
                  Quantity</span>
                <div className="flex gap-2.5">
                  <input name="qty" type="number" min="1" required
                    className="flex-1 h-[46px] rounded-ctl border border-hairline-strong
                    bg-surface px-3 text-sm text-ink" />
                  <div className="flex rounded-ctl border border-hairline-strong overflow-hidden shrink-0">
                    {(['add','subtract'] as const).map((d,i) => (
                      <button type="button" key={d} onClick={() => setDir(d)}
                        className={`px-4 font-display font-semibold text-[12.5px] ${
                          i===1 ? 'border-l border-hairline-strong' : ''} ${
                          dir===d ? 'bg-primary text-on-primary' : 'bg-surface text-muted'}`}>
                        {d==='add' ? 'Add' : 'Subtract'}</button>
                    ))}
                  </div>
                </div>
              </div>
              <Input label="Unit cost (optional, ₦)" name="unitCost" type="number" step="0.01" />
              <Input label="Reason" name="reason" />
              <button type="submit" className={`w-full ${buttonClass('primary')}`}>
                Record movement</button>
            </form>
            <div className="mt-[18px] border-t border-hairline pt-3.5">
              <div className="text-[11px] uppercase tracking-wide text-muted mb-2.5">
                Recent movements</div>
              {hist.length === 0 && <p className="text-xs text-faint">No movements yet.</p>}
              {hist.slice(0,6).map(m => (
                <div key={m.id} className="flex items-center justify-between text-xs
                  py-[7px] border-b border-surface-2 last:border-0">
                  <span className="text-ink">{m.type}{m.reason ? ` · ${m.reason}` : ''}</span>
                  <span className={`font-mono ${m.qty_delta < 0 ? 'text-negative' : 'text-positive'}`}>
                    {m.qty_delta > 0 ? '+' : ''}{m.qty_delta}</span>
                  <span className="font-mono text-[10.5px] text-faint">
                    {new Date(m.created_at).toISOString().slice(0,10)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
