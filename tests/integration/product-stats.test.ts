import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createProduct } from '@/lib/products/products';
import { recordStockMovement } from '@/lib/products/stock';
import { productStats } from '@/lib/products/stats';

describe('productStats', () => {
  it('counts active, low-stock at/below threshold, inventory value', async () => {
    await q(`delete from tenants where slug='ps-1'`);
    const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('S','ps-1') returning id`);
    const a = await createProduct(t.id,{ sku:'P1',name:'a',sellingPrice:10,costPrice:4,
      reorderThreshold:5,openingQuantity:5,actor:'u' });           // low (5<=5), value 20
    await createProduct(t.id,{ sku:'P2',name:'b',sellingPrice:10,costPrice:2,
      reorderThreshold:5,openingQuantity:50,actor:'u' });          // ok, value 100
    void a;
    const s = await productStats(t.id);
    expect(s.totalActive).toBe(2);
    expect(s.lowStockCount).toBe(1);
    expect(s.inventoryValue).toBe(120);
  });
});
