import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createProduct } from '@/lib/products/products';
import { recordStockMovement, listMovements } from '@/lib/products/stock';

async function tid(slug:string){ await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('S',$1) returning id`,[slug]);
  return t.id; }

describe('stock domain', () => {
  it('records movements and stays drift-free under concurrency', async () => {
    const t = await tid('sd-1');
    const pid = await createProduct(t, { sku:'C1', name:'x', sellingPrice:1, actor:'u1' });
    await Promise.all(Array.from({length:20}, () =>
      recordStockMovement(t, { productId:pid, type:'receipt', qtyDelta:5, actor:'u1' })));
    const [p] = await q<{current_quantity:number}>(
      `select current_quantity from products where id=$1`,[pid]);
    const mv = await listMovements(t, pid);
    const sum = mv.reduce((s,m)=>s+m.qty_delta,0);
    expect(p.current_quantity).toBe(100);
    expect(sum).toBe(100); // ledger and cache agree exactly
  });
});
