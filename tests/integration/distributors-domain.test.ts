import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createDistributor, updateDistributor, listDistributors, getDistributor }
  from '@/lib/distributors/distributors';

async function tid(slug:string){ await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('D',$1) returning id`,[slug]);
  return t.id; }

describe('distributors domain — create/update/list/get', () => {
  it('creates with a shell shop_user and via an existing shop_user', async () => {
    const t = await tid('dd-1');
    const id1 = await createDistributor(t, { businessName:'Acme Dist',
      email:'acme@x.com', contactName:'Ada', region:'Lagos', creditLimit:5000 });
    const d1 = await getDistributor(t, id1);
    expect(d1!.status).toBe('pending');
    expect(Number(d1!.credit_limit)).toBe(5000);
    const [su] = await q<{id:string}>(`select id from shop_users where id=$1`,[d1!.shop_user_id]);
    expect(su.id).toBe(d1!.shop_user_id);
    const [{ph}] = await q<{ph:string}>(`select password_hash ph from shop_users where id=$1`,
      [d1!.shop_user_id]);
    expect(ph).toBe('!shell');
    const [su2] = await q<{id:string}>(`insert into shop_users(tenant_id,email,password_hash,full_name)
      values($1,'ex@x.com','hash','Ex') returning id`,[t]);
    const id2 = await createDistributor(t, { shopUserId: su2.id, businessName:'Ex Dist' });
    expect((await getDistributor(t,id2))!.shop_user_id).toBe(su2.id);
    await updateDistributor(t, id1, { region:'Oyo' });
    expect((await getDistributor(t,id1))!.region).toBe('Oyo');
    const list = await listDistributors(t, {});
    expect(list.length).toBe(2);
  });
});
