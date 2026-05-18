import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createProduct, archiveProduct, listProducts } from '@/lib/products/products';
import { recordStockMovement } from '@/lib/products/stock';
import { requestImageUpload, attachImage } from '@/lib/products/images';
import { productStats } from '@/lib/products/stats';
import { __resetStorage } from '@/lib/products/storage';

describe('products E2E + isolation', () => {
  it('create(+image,+opening) -> receive -> adjust -> archive; stats; tenant isolation', async () => {
    __resetStorage(); delete process.env.R2_BUCKET;
    await q(`delete from tenants where slug in ('e2p-a','e2p-b')`);
    const [a]=await q<{id:string}>(`insert into tenants(name,slug) values('A','e2p-a') returning id`);
    const [b]=await q<{id:string}>(`insert into tenants(name,slug) values('B','e2p-b') returning id`);
    const pid = await createProduct(a.id,{ sku:'E1',name:'Gari',sellingPrice:1200,
      costPrice:800,reorderThreshold:10,openingQuantity:50,actor:'u1' });
    const slot = await requestImageUpload(a.id,pid,'image/png',2048);
    await attachImage(a.id,pid,slot.key);
    await recordStockMovement(a.id,{ productId:pid,type:'receipt',qtyDelta:30,actor:'u1' });
    await recordStockMovement(a.id,{ productId:pid,type:'adjustment',qtyDelta:-5,
      reason:'damaged',actor:'u1' });
    const [p]=await q<{current_quantity:number}>(
      `select current_quantity from products where id=$1`,[pid]);
    expect(p.current_quantity).toBe(75); // 50+30-5
    const s = await productStats(a.id);
    expect(s.totalActive).toBe(1); expect(s.inventoryValue).toBe(75*800);
    // tenant B sees nothing
    const bList = await listProducts(b.id, {});
    expect(bList).toEqual([]);
    await archiveProduct(a.id,pid);
    expect((await listProducts(a.id,{})).length).toBe(0);
  });
});
