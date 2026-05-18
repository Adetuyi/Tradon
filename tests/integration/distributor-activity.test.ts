import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createDistributor, setStatus, setCreditLimit } from '@/lib/distributors/distributors';
import { listDistributorActivity } from '@/lib/distributors/activity';

async function tid(slug:string){ await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('A',$1) returning id`,[slug]);
  return t.id; }

describe('listDistributorActivity', () => {
  it('returns this distributor audit rows newest-first; tenant-isolated', async () => {
    const t = await tid('da-1');
    const id = await createDistributor(t,{ businessName:'A',email:'a@x.com',
      contactName:'A',creditLimit:1000 });
    await setStatus(t, id, 'active', 'u1');           // distributor.status_changed
    await setCreditLimit(t, id, 2000, 'u1');          // distributor.credit_limit_changed
    const rows = await listDistributorActivity(t, id);
    expect(rows.map(r=>r.action)).toEqual(
      ['distributor.credit_limit_changed','distributor.status_changed']); // newest first
    expect(rows[0].meta.new).toBe(2000); expect(rows[0].actor).toBe('u1');
    const other = await tid('da-2');
    expect(await listDistributorActivity(other, id)).toEqual([]); // RLS-isolated
  });
});
