import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createDistributor, setStatus, getDistributor } from '@/lib/distributors/distributors';

async function tid(slug:string){ await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('D',$1) returning id`,[slug]);
  return t.id; }

describe('distributor status machine', () => {
  it('valid transitions; activate sets shop_users.status; invalid raises; archived terminal', async () => {
    const t = await tid('ds-1');
    const id = await createDistributor(t, { businessName:'S', email:'s@x.com',
      contactName:'S', creditLimit:100 });
    const d = await getDistributor(t, id);
    await expect(setStatus(t, id, 'suspended', 'u1')).rejects.toThrow(); // pending->suspended invalid
    await setStatus(t, id, 'active', 'u1');                              // pending->active ok
    const [su] = await q<{status:string}>(`select status from shop_users where id=$1`,
      [d!.shop_user_id]);
    expect(su.status).toBe('distributor');
    await setStatus(t, id, 'suspended', 'u1');                           // active->suspended ok
    await setStatus(t, id, 'active', 'u1');                              // suspended->active ok
    await setStatus(t, id, 'archived', 'u1');                            // active->archived ok
    await expect(setStatus(t, id, 'active', 'u1')).rejects.toThrow();    // archived terminal
    const [a] = await q(`select action from audit_log where tenant_id=$1
      and action='distributor.status_changed' limit 1`,[t]);
    expect(a.action).toBe('distributor.status_changed');
  });
});
