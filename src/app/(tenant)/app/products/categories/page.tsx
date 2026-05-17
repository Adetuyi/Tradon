import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { AppShell } from '@/components/ui/AppShell';
import { withTenant } from '@/lib/db/withTenant';
import { buttonClass } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createCategoryAction, renameCategoryAction, archiveCategoryAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const tenant = await resolveTenant((await headers()).get('host') ?? '');
  if (!tenant) redirect('/not-found-tenant');
  const session = await getStaffSession(tenant.id);
  if (!session) redirect('/login');
  const principal = session.membership
    ? { role: session.membership.role, isPlatform: false } : null;
  await requirePermission(principal, 'products.read');

  const rows = await withTenant(tenant.id, async c => (await c.query(
    `select c.id, c.name,
       count(p.id) filter (where p.status='active')::int as product_count
     from categories c left join products p on p.category_id=c.id
     where c.status='active' group by c.id, c.name order by c.name`)).rows
  ) as { id:string; name:string; product_count:number }[];

  return (
    <AppShell tenantName={tenant.slug} role={session.membership!.role}>
      <div className="w-full max-w-[720px]">
        <h1 className="font-display font-bold text-2xl text-ink">Categories</h1>
        <p className="text-sm text-muted mt-1.5 mb-6">Organize the catalog.
          Archived categories keep historical product links.</p>
        <form action={createCategoryAction} className="flex gap-3 items-end mb-6 max-w-[520px]">
          <div className="flex-1"><Input label="New category" name="name" required /></div>
          <button type="submit" className={buttonClass('primary')}>Add</button>
        </form>
        <div className="bg-surface border border-hairline rounded-card overflow-hidden">
          {rows.length === 0 && (
            <div className="px-4 py-10 text-center text-muted text-sm">
              No categories yet.</div>)}
          {rows.map(r => (
            <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3
              px-4 py-3 border-t border-hairline first:border-t-0">
              <form action={renameCategoryAction} className="flex gap-2 items-center flex-1">
                <input type="hidden" name="id" value={r.id} />
                <input name="name" defaultValue={r.name}
                  className="h-10 flex-1 rounded-ctl border border-hairline-strong
                  bg-surface px-3 text-sm text-ink" />
                <button type="submit" className="text-xs text-signal font-medium">Save</button>
              </form>
              <span className="font-mono text-xs text-muted">{r.product_count} products</span>
              <form action={archiveCategoryAction}>
                <input type="hidden" name="id" value={r.id} />
                <button type="submit" className="text-xs text-negative font-medium">Archive</button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
