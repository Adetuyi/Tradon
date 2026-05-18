import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createDistributor, setStatus } from '@/lib/distributors/distributors';
import { recordCreditMovement } from '@/lib/distributors/credit';
import { distributorStats } from '@/lib/distributors/stats';

describe('distributorStats', () => {
  it('counts active/pending, sums outstanding, flags over-limit', async () => {
    await q(`delete from tenants where slug='dst-1'`);
    const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('S','dst-1') returning id`);
    const a = await createDistributor(t.id,{ businessName:'A',email:'a@x.com',
      contactName:'A',creditLimit:1000 });
    await setStatus(t.id, a, 'active', 'u');
    await recordCreditMovement(t.id,{ distributorId:a, type:'purchase_draw', delta:1000, actor:'u' });
    await createDistributor(t.id,{ businessName:'B',email:'b@x.com',contactName:'B' }); // pending
    const s = await distributorStats(t.id);
    expect(s.totalActive).toBe(1);
    expect(s.pendingCount).toBe(1);
    expect(s.totalOutstanding).toBe(1000);
    expect(s.overLimitCount).toBe(1); // A at 1000/1000
  });
});
