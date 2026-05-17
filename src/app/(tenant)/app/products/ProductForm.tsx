'use client';
import { useState } from 'react';
import { createProductAction, updateProductAction,
  requestImageUploadAction, attachImageAction } from './actions';
import { buttonClass } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Cat = { id: string; name: string };
type P = { id:string; sku:string; name:string; selling_price:string; cost_price:string;
  unit:string; reorder_threshold:number; category_id:string|null; image_key:string|null };

export function ProductForm({ categories, product }:
  { categories: Cat[]; product?: P }) {
  const [open, setOpen] = useState(false);
  const [imageKey, setImageKey] = useState<string | null>(product?.image_key ?? null);
  const [err, setErr] = useState<string | null>(null);
  const editing = !!product;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !product) return;
    setErr(null);
    try {
      const slot = await requestImageUploadAction(product.id, f.type, f.size);
      await fetch(slot.url, { method:'PUT', body:f, headers:{ 'Content-Type': f.type } });
      await attachImageAction(product.id, slot.key);
      setImageKey(slot.key);
    } catch (e2) { setErr((e2 as Error).message); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={editing ? 'text-xs text-signal font-medium' : buttonClass('primary')}>
        {editing ? 'Edit' : '+ New product'}</button>
      {open && (
        <div className="fixed inset-0 z-40 bg-ink/30 flex items-start sm:items-start
          justify-center p-0 sm:p-7 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-surface w-full sm:max-w-[420px] rounded-t-card sm:rounded-card
            p-6 my-0 sm:my-0 max-h-[100dvh] sm:max-h-[92dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg text-ink">
              {editing ? 'Edit product' : 'New product'}</h3>
            <p className="text-xs text-muted mb-4">
              {editing ? 'Update catalog details.'
                : 'Add it to the catalog. Opening quantity is recorded as a stock receipt.'}</p>
            <form action={editing ? updateProductAction : createProductAction}>
              {editing && <input type="hidden" name="id" defaultValue={product!.id} />}
              <Input label="Name" name="name" defaultValue={product?.name} required />
              {!editing && <Input label="SKU" name="sku" required />}
              <label className="block mb-4">
                <span className="block text-[11px] uppercase tracking-wide text-muted mb-[7px]">
                  Category</span>
                <select name="categoryId" defaultValue={product?.category_id ?? ''}
                  className="h-[46px] w-full rounded-ctl border border-hairline-strong
                  bg-surface px-3 text-sm text-ink">
                  <option value="">— none —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Selling price (₦)" name="sellingPrice" type="number" step="0.01"
                  defaultValue={product?.selling_price} required />
                <Input label="Cost price (₦)" name="costPrice" type="number" step="0.01"
                  defaultValue={product?.cost_price ?? '0'} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Unit" name="unit" defaultValue={product?.unit ?? 'unit'} />
                <Input label="Reorder threshold" name="reorderThreshold" type="number"
                  defaultValue={String(product?.reorder_threshold ?? 0)} />
              </div>
              {!editing && <Input label="Opening quantity" name="openingQuantity"
                type="number" defaultValue="0" />}
              {editing && (
                <div className="mb-4">
                  <span className="block text-[11px] uppercase tracking-wide text-muted mb-[7px]">
                    Image</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp"
                    onChange={onFile} className="text-sm text-muted" />
                  {imageKey && <p className="text-xs text-positive mt-1">Image attached</p>}
                  {err && <p className="text-xs text-negative mt-1">{err}</p>}
                </div>
              )}
              <input type="hidden" name="imageKey" value={imageKey ?? ''} />
              <button type="submit" className={`w-full ${buttonClass('primary')}`}>
                {editing ? 'Save changes' : 'Create product'}</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
