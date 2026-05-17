import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createProduct, updateProduct, archiveProduct, listProducts, getProduct }
  from '@/lib/products/products';

async function tid(slug:string){ await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('P',$1) returning id`,[slug]);
  return t.id; }

describe('products domain', () => {
  it('create (opening qty -> receipt), update, archive, list filters active', async () => {
    const t = await tid('pd-1');
    const id = await createProduct(t, { sku:'A1', name:'Malt', sellingPrice:700,
      costPrice:500, unit:'carton', reorderThreshold:5, openingQuantity:20, actor:'u1' });
    const p = await getProduct(t, id);
    expect(p!.current_quantity).toBe(20);          // opening qty became a receipt movement
    const [{n}] = await q<{n:number}>(
      `select count(*)::int n from stock_movements where product_id=$1 and type='receipt'`,[id]);
    expect(n).toBe(1);
    await updateProduct(t, id, { name:'Malt 33cl', sellingPrice:750 });
    await archiveProduct(t, id);
    const active = await listProducts(t, {});
    expect(active.find(x=>x.id===id)).toBeUndefined(); // archived excluded by default
  });
});
