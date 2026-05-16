import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { recordConsent } from '@/lib/compliance/consent';

describe('consent capture', () => {
  it('records subject + policy version + timestamp', async () => {
    await q(`delete from tenants where slug='con-t'`);
    const [t] = await q<{id:string}>(`insert into tenants(name,slug)
      values('Con','con-t') returning id`);
    await recordConsent({ tenantId: t.id, subject: 'shop:abc',
      policy: 'terms', version: '2026-05-16' });
    const [row] = await q(`select policy,version from policy_acceptance
      where tenant_id=$1 and subject='shop:abc'`, [t.id]);
    expect(row).toMatchObject({ policy: 'terms', version: '2026-05-16' });
  });
});
