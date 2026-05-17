import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { withTenant } from '@/lib/db/withTenant';

async function seed(slug:string){
  await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('X',$1) returning id`,[slug]);
  const [p]=await q<{id:string}>(
    `insert into products(tenant_id,sku,name,selling_price) values($1,'I1','x',1) returning id`,[t.id]);
  return { tid:t.id, pid:p.id };
}

describe('record_stock_movement integrity', () => {
  it('atomically updates ledger + current_quantity', async () => {
    const { tid, pid } = await seed('si-a');
    await withTenant(tid, c => c.query(
      `select record_stock_movement($1,'receipt',15,null,'opening','u1')`,[pid]));
    const [p]=await q<{current_quantity:number}>(`select current_quantity from products where id=$1`,[pid]);
    const [{n}]=await q<{n:number}>(`select count(*)::int n from stock_movements where product_id=$1`,[pid]);
    expect(p.current_quantity).toBe(15); expect(n).toBe(1);
  });
  it('rejects a movement that would drive stock negative (tx aborts)', async () => {
    const { tid, pid } = await seed('si-b');
    await withTenant(tid, c => c.query(`select record_stock_movement($1,'receipt',5,null,null,'u1')`,[pid]));
    await expect(withTenant(tid, c =>
      c.query(`select record_stock_movement($1,'adjustment',-9,null,'spoil','u1')`,[pid])
    )).rejects.toThrow();
    const [p]=await q<{current_quantity:number}>(`select current_quantity from products where id=$1`,[pid]);
    expect(p.current_quantity).toBe(5); // unchanged
  });
  it('blocks direct stock_movements insert (drift impossible)', async () => {
    const { tid, pid } = await seed('si-c');
    await expect(withTenant(tid, c => c.query(
      `insert into stock_movements(tenant_id,product_id,type,qty_delta,actor)
       values(current_tenant_id(),$1,'receipt',3,'u1')`,[pid]
    ))).rejects.toThrow(/record_stock_movement/i);
  });
});
