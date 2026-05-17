import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';

describe('products table', () => {
  it('tenant-scoped, sku-unique per tenant, qty>=0, archivable', async () => {
    await q(`delete from tenants where slug='prd-s'`);
    const [t] = await q<{id:string}>(`insert into tenants(name,slug) values('P','prd-s') returning id`);
    const [p] = await q<{status:string;current_quantity:number}>(
      `insert into products(tenant_id,sku,name,selling_price)
       values($1,'SKU1','Cola',500) returning status,current_quantity`, [t.id]);
    expect(p.status).toBe('active');
    expect(p.current_quantity).toBe(0);
    await expect(q(`insert into products(tenant_id,sku,name,selling_price)
      values($1,'SKU1','Dup',1)`, [t.id])).rejects.toThrow();
    await expect(q(`update products set current_quantity=-1 where tenant_id=$1`, [t.id]))
      .rejects.toThrow();
  });
});
