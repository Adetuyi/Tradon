import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createDistributor, setStatus, setCreditLimit, listDistributors }
  from '@/lib/distributors/distributors';
import { recordCreditMovement } from '@/lib/distributors/credit';
import { distributorStats } from '@/lib/distributors/stats';

describe('distributors & credits E2E + isolation', () => {
  it('create→approve→limit→draw→over-limit reject→repay→suspend blocks draw→archive; isolation', async () => {
    await q(`delete from tenants where slug in ('e2d-a','e2d-b')`);
    const [a]=await q<{id:string}>(`insert into tenants(name,slug) values('A','e2d-a') returning id`);
    const [b]=await q<{id:string}>(`insert into tenants(name,slug) values('B','e2d-b') returning id`);
    const id = await createDistributor(a.id,{ businessName:'Gari Co',
      email:'g@x.com', contactName:'G', region:'Kano', creditLimit:1000 });
    await setStatus(a.id, id, 'active', 'u1');
    await setCreditLimit(a.id, id, 2000, 'u1');
    await recordCreditMovement(a.id,{ distributorId:id, type:'purchase_draw',
      delta:1500, actor:'u1' });
    await expect(recordCreditMovement(a.id,{ distributorId:id, type:'purchase_draw',
      delta:600, actor:'u1' })).rejects.toThrow();              // 1500+600 > 2000
    await recordCreditMovement(a.id,{ distributorId:id, type:'repayment',
      delta:-500, reason:'paid', actor:'u1' });
    const [d]=await q<{outstanding:string}>(`select outstanding from distributors where id=$1`,[id]);
    expect(Number(d.outstanding)).toBe(1000);                   // 1500-500
    await setStatus(a.id, id, 'suspended', 'u1');
    await expect(recordCreditMovement(a.id,{ distributorId:id, type:'purchase_draw',
      delta:10, actor:'u1' })).rejects.toThrow(/active/i);      // suspended blocks draw
    const s = await distributorStats(a.id);
    expect(s.totalOutstanding).toBe(1000);
    expect(await listDistributors(b.id, {})).toEqual([]);       // tenant B sees nothing
    await setStatus(a.id, id, 'archived', 'u1');
    expect((await listDistributors(a.id,{ status:'active' })).length).toBe(0);
  });
});
