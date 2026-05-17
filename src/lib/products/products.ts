import { withTenant } from '@/lib/db/withTenant';

export type ProductInput = {
  sku: string; name: string; categoryId?: string | null;
  sellingPrice: number; costPrice?: number; unit?: string;
  reorderThreshold?: number; openingQuantity?: number; imageKey?: string | null;
  actor: string;
};
export type Product = {
  id: string; sku: string; name: string; category_id: string | null;
  selling_price: string; cost_price: string; unit: string;
  reorder_threshold: number; current_quantity: number; status: string;
  image_key: string | null;
};

export async function createProduct(tenantId: string, i: ProductInput): Promise<string> {
  return withTenant(tenantId, async c => {
    const id = (await c.query(
      `insert into products(tenant_id,sku,name,category_id,selling_price,cost_price,
         unit,reorder_threshold,image_key)
       values(current_tenant_id(),$1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [i.sku, i.name, i.categoryId ?? null, i.sellingPrice, i.costPrice ?? 0,
       i.unit ?? 'unit', i.reorderThreshold ?? 0, i.imageKey ?? null])).rows[0].id as string;
    if (i.openingQuantity && i.openingQuantity > 0) {
      await c.query(`select record_stock_movement($1,'receipt',$2,$3,'opening stock',$4)`,
        [id, i.openingQuantity, i.costPrice ?? null, i.actor]);
    }
    return id;
  });
}

export async function updateProduct(tenantId: string, id: string,
  patch: Partial<Pick<ProductInput,'name'|'sku'|'categoryId'|'sellingPrice'|'costPrice'|'unit'|'reorderThreshold'|'imageKey'>>) {
  const cols: string[] = []; const vals: unknown[] = []; let n = 1;
  const map: Record<string,string> = { name:'name', sku:'sku', categoryId:'category_id',
    sellingPrice:'selling_price', costPrice:'cost_price', unit:'unit',
    reorderThreshold:'reorder_threshold', imageKey:'image_key' };
  for (const [k,v] of Object.entries(patch)) {
    if (v === undefined) continue; cols.push(`${map[k]}=$${n++}`); vals.push(v);
  }
  if (!cols.length) return;
  vals.push(id);
  await withTenant(tenantId, c => c.query(
    `update products set ${cols.join(',')}, updated_at=now() where id=$${n}`, vals));
}

export async function archiveProduct(tenantId: string, id: string) {
  await withTenant(tenantId, c => c.query(
    `update products set status='archived', updated_at=now() where id=$1`, [id]));
}

export async function listProducts(tenantId: string,
  f: { search?: string; categoryId?: string; includeArchived?: boolean }): Promise<Product[]> {
  return withTenant(tenantId, async c => {
    const w: string[] = []; const v: unknown[] = []; let n = 1;
    if (!f.includeArchived) w.push(`status='active'`);
    if (f.search) { w.push(`(name ilike $${n} or sku ilike $${n})`); v.push(`%${f.search}%`); n++; }
    if (f.categoryId) { w.push(`category_id=$${n++}`); v.push(f.categoryId); }
    const sql = `select id,sku,name,category_id,selling_price,cost_price,unit,
      reorder_threshold,current_quantity,status,image_key from products
      ${w.length?`where ${w.join(' and ')}`:''} order by name`;
    return (await c.query(sql, v)).rows;
  });
}

export async function getProduct(tenantId: string, id: string): Promise<Product | null> {
  return withTenant(tenantId, async c => (await c.query(
    `select id,sku,name,category_id,selling_price,cost_price,unit,reorder_threshold,
       current_quantity,status,image_key from products where id=$1`, [id])).rows[0] ?? null);
}
