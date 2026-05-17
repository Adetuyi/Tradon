import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { AppShell } from '@/components/ui/AppShell';
import { listProducts } from '@/lib/products/products';
import { productStats } from '@/lib/products/stats';
import { listCategories } from '@/lib/products/categories';
import { ProductForm } from './ProductForm';
import { StockAdjust } from './StockAdjust';

export const dynamic = 'force-dynamic';

export default async function ProductsPage({ searchParams }:
  { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const sp = await searchParams;
  const tenant = await resolveTenant((await headers()).get('host') ?? '');
  if (!tenant) redirect('/not-found-tenant');
  const session = await getStaffSession(tenant.id);
  if (!session) redirect('/login');
  const principal = session.membership
    ? { role: session.membership.role, isPlatform: false } : null;
  await requirePermission(principal, 'products.read');

  const [stats, products, categories] = await Promise.all([
    productStats(tenant.id),
    listProducts(tenant.id, { search: sp.q, categoryId: sp.cat }),
    listCategories(tenant.id),
  ]);
  const catName = new Map(categories.map(c => [c.id, c.name]));
  const fmt = (n: number) => '₦' + n.toLocaleString('en-NG');

  return (
    <AppShell tenantName={tenant.slug} role={session.membership!.role}>
      <div className="w-full max-w-[1100px]">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <h1 className="font-display font-bold text-2xl text-ink">Products</h1>
          <ProductForm categories={categories} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[['Total products', String(stats.totalActive), 'active SKUs', false],
            ['Low stock', String(stats.lowStockCount), 'at/below reorder', true],
            ['Inventory value', fmt(stats.inventoryValue), 'at cost', false]].map(
            ([l,v,d,warn]) => (
            <div key={l as string} className="bg-surface border border-hairline rounded-card p-5">
              <div className="text-[11px] uppercase tracking-wide text-muted">{l}</div>
              <div className="font-display font-bold text-2xl text-ink mt-2">{v}</div>
              <div className={`font-mono text-[11px] mt-1 ${warn ? 'text-negative' : 'text-muted'}`}>{d}</div>
            </div>
          ))}
        </div>
        <div className="bg-surface border border-hairline rounded-card overflow-hidden">
          <div className="overflow-x-auto"><div className="min-w-[840px]">
            <div className="grid grid-cols-[2fr_0.9fr_0.8fr_0.8fr_0.6fr_0.7fr_0.7fr] bg-surface-2
              text-[10.5px] uppercase tracking-wide text-muted font-semibold">
              {['Product','Category','Price','Cost','Qty','Status','Actions'].map(h =>
                <div key={h} className="px-4 py-3">{h}</div>)}
            </div>
            {products.length === 0 && (
              <div className="px-4 py-14 text-center">
                <div className="w-12 h-12 rounded-card bg-green-50 border border-green-200
                  mx-auto mb-3.5 flex items-center justify-center text-primary">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.5"><path d="M21 8 12 3 3 8l9 5 9-5Z"/>
                    <path d="M3 8v8l9 5 9-5V8"/></svg></div>
                <h3 className="font-display font-semibold text-base text-ink">No products yet</h3>
                <p className="text-[12.5px] text-muted mt-1.5">
                  Create your first product to start tracking inventory and stock movements.</p>
              </div>
            )}
            {products.map(p => {
              const low = p.current_quantity <= p.reorder_threshold;
              return (
              <div key={p.id} className="grid grid-cols-[2fr_0.9fr_0.8fr_0.8fr_0.6fr_0.7fr_0.7fr]
                border-t border-hairline text-[13px] items-center">
                <div className="px-4 py-3 flex items-center gap-3">
                  <span className="w-[38px] h-[38px] rounded-lg bg-green-50 border border-green-200
                    shrink-0 flex items-center justify-center text-green-400">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="1.6"><path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/></svg>
                  </span>
                  <span><span className="text-ink font-medium">{p.name}</span><br/>
                    <span className="font-mono text-[11px] text-muted">{p.sku}</span></span>
                </div>
                <div className="px-4 py-3 text-muted">
                  {p.category_id ? catName.get(p.category_id) ?? '—' : '—'}</div>
                <div className="px-4 py-3 font-mono">{fmt(Number(p.selling_price))}</div>
                <div className="px-4 py-3 font-mono text-muted">{fmt(Number(p.cost_price))}</div>
                <div className="px-4 py-3 font-mono">
                  <span className={low ? 'text-negative' : 'text-ink'}>{p.current_quantity}</span></div>
                <div className="px-4 py-3">
                  <span className={`font-mono text-[10.5px] px-2.5 py-1 rounded-full border ${
                    p.status==='archived' ? 'bg-surface-2 text-muted border-hairline'
                    : low ? 'bg-surface-2 text-negative border-hairline'
                    : 'bg-green-50 text-primary-700 border-green-200'}`}>
                    {p.status==='archived' ? 'Archived' : low ? 'Low' : 'Active'}</span></div>
                <div className="px-4 py-3"><span className="flex gap-3 items-center"><ProductForm categories={categories} product={{
                  id: p.id, sku: p.sku, name: p.name,
                  selling_price: String(p.selling_price),
                  cost_price: String(p.cost_price),
                  unit: p.unit, reorder_threshold: p.reorder_threshold,
                  category_id: p.category_id ?? null,
                  image_key: p.image_key ?? null,
                }} /><StockAdjust productId={p.id} name={p.name} /></span></div>
              </div>
            );})}
          </div></div>
        </div>
      </div>
    </AppShell>
  );
}
