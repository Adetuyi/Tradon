import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createDistributor, setStatus } from '@/lib/distributors/distributors';
import { recordCreditMovement, listCreditMovements } from '@/lib/distributors/credit';

async function tid(slug:string){ await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('C',$1) returning id`,[slug]);
  return t.id; }

describe('credit domain', () => {
  it('records movements; concurrent draws stay drift-free and within limit', async () => {
    const t = await tid('cd-1');
    const id = await createDistributor(t,{ businessName:'C',email:'c@x.com',
      contactName:'C',creditLimit:1000 });
    await setStatus(t, id, 'active', 'u1');
    const res = await Promise.allSettled(Array.from({length:20}, () =>
      recordCreditMovement(t,{ distributorId:id, type:'purchase_draw', delta:50, actor:'u1' })));
    const ok = res.filter(r=>r.status==='fulfilled').length;
    const [d]=await q<{outstanding:string}>(`select outstanding from distributors where id=$1`,[id]);
    const mv = await listCreditMovements(t, id);
    const sum = mv.reduce((s,m)=>s+Number(m.delta),0);
    expect(Number(d.outstanding)).toBe(ok*50);
    expect(sum).toBe(ok*50);
    expect(Number(d.outstanding)).toBeLessThanOrEqual(1000);
  });
});
