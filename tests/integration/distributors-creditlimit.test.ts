import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createDistributor, setStatus, setCreditLimit, getDistributor }
  from '@/lib/distributors/distributors';
import { recordCreditMovement } from '@/lib/distributors/credit';

async function tid(slug:string){ await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('D',$1) returning id`,[slug]);
  return t.id; }

describe('setCreditLimit', () => {
  it('updates limit, audits old/new, rejects a limit below outstanding', async () => {
    const t = await tid('dl-1');
    const id = await createDistributor(t,{ businessName:'L',email:'l@x.com',
      contactName:'L',creditLimit:1000 });
    await setStatus(t, id, 'active', 'u1');
    await recordCreditMovement(t,{ distributorId:id, type:'purchase_draw',
      delta:600, actor:'u1' });
    await setCreditLimit(t, id, 2000, 'u1');
    expect(Number((await getDistributor(t,id))!.credit_limit)).toBe(2000);
    const [a] = await q(`select meta from audit_log where tenant_id=$1
      and action='distributor.credit_limit_changed' order by created_at desc limit 1`,[t]);
    expect(a.meta.old).toBe(1000); expect(a.meta.new).toBe(2000);
    await expect(setCreditLimit(t, id, 500, 'u1')).rejects.toThrow(/outstanding/i);
  });
});
