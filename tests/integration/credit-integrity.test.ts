import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { withTenant } from '@/lib/db/withTenant';

async function seed(slug:string, status='active', limit=1000){
  await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('X',$1) returning id`,[slug]);
  const [su]=await q<{id:string}>(`insert into shop_users(tenant_id,email,password_hash,full_name)
    values($1,$2,'!shell','B') returning id`,[t.id, `${slug}@x.com`]);
  const [d]=await q<{id:string}>(`insert into distributors(tenant_id,shop_user_id,business_name,
    credit_limit,status) values($1,$2,'B',$3,$4) returning id`,[t.id,su.id,limit,status]);
  return { tid:t.id, did:d.id };
}

describe('record_credit_movement integrity', () => {
  it('atomically updates ledger + outstanding', async () => {
    const { tid, did } = await seed('ci-a');
    await withTenant(tid, c => c.query(
      `select record_credit_movement($1,'purchase_draw',300,'order','u1')`,[did]));
    const [d]=await q<{outstanding:string}>(`select outstanding from distributors where id=$1`,[did]);
    const [{n}]=await q<{n:number}>(`select count(*)::int n from credit_movements where distributor_id=$1`,[did]);
    expect(Number(d.outstanding)).toBe(300); expect(n).toBe(1);
  });
  it('rejects an over-limit draw (tx aborts, outstanding unchanged)', async () => {
    const { tid, did } = await seed('ci-b', 'active', 500);
    await withTenant(tid, c => c.query(`select record_credit_movement($1,'purchase_draw',400,null,'u1')`,[did]));
    await expect(withTenant(tid, c =>
      c.query(`select record_credit_movement($1,'purchase_draw',200,null,'u1')`,[did])
    )).rejects.toThrow();
    const [d]=await q<{outstanding:string}>(`select outstanding from distributors where id=$1`,[did]);
    expect(Number(d.outstanding)).toBe(400);
    const [{n}]=await q<{n:number}>(`select count(*)::int n from credit_movements where distributor_id=$1`,[did]);
    expect(n).toBe(1); // first 400 draw only; the rejected over-limit draw persisted no ledger row
  });
  it('rejects purchase_draw when not active; allows repayment when suspended', async () => {
    const { tid, did } = await seed('ci-c', 'suspended', 1000);
    await expect(withTenant(tid, c =>
      c.query(`select record_credit_movement($1,'purchase_draw',100,null,'u1')`,[did])
    )).rejects.toThrow(/active/i);
    await withTenant(tid, c => c.query(`select record_credit_movement($1,'adjustment',100,'opening','u1')`,[did]));
    await withTenant(tid, c => c.query(`select record_credit_movement($1,'repayment',-60,'paid','u1')`,[did]));
    const [d]=await q<{outstanding:string}>(`select outstanding from distributors where id=$1`,[did]);
    expect(Number(d.outstanding)).toBe(40);
  });
  it('blocks a direct credit_movements insert (drift impossible)', async () => {
    const { tid, did } = await seed('ci-d');
    await expect(withTenant(tid, c => c.query(
      `insert into credit_movements(tenant_id,distributor_id,type,delta,actor)
       values(current_tenant_id(),$1,'purchase_draw',5,'u1')`,[did]
    ))).rejects.toThrow(/record_credit_movement/i);
  });
});
