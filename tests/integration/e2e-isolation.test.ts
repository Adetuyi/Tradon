import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { provisionTenant } from '@/lib/provisioning/provisionTenant';
import { registerShopUser } from '@/lib/auth/shop';
import { withTenant } from '@/lib/db/withTenant';

describe('end-to-end tenant isolation', () => {
  it('tenant B cannot see tenant A shop users via the scoped client', async () => {
    await q(`delete from tenants where slug in ('e2e-a','e2e-b')`);
    const a = await provisionTenant({ name:'A',slug:'e2e-a',
      ownerUserId:'oa',region:'NG',currency:'NGN' });
    const b = await provisionTenant({ name:'B',slug:'e2e-b',
      ownerUserId:'ob',region:'NG',currency:'NGN' });
    await registerShopUser(a.tenantId, 'secret@a.com', 'pw', 'A User');
    const seenByB = await withTenant(b.tenantId, async (c) =>
      (await c.query(`select email from shop_users`)).rows);
    expect(seenByB).toEqual([]);
  });
});
