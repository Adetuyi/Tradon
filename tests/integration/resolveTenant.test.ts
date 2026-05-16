import { describe, it, expect, beforeAll } from 'vitest';
import { q } from '../helpers/db';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';

describe('resolveTenant', () => {
  beforeAll(async () => {
    await q(`delete from tenants where slug in ('rt-active','rt-off')`);
    const [a] = await q<{id:string}>(`insert into tenants(name,slug)
      values('Active','rt-active') returning id`);
    await q(`insert into domains(tenant_id,host,type)
      values($1,'rt-active.tradon.app','subdomain')`, [a.id]);
    await q(`insert into tenants(name,slug,status)
      values('Off','rt-off','inactive')`);
  });
  it('resolves an active subdomain tenant', async () => {
    const t = await resolveTenant('rt-active.tradon.app');
    expect(t?.slug).toBe('rt-active');
  });
  it('returns null for unknown host', async () => {
    expect(await resolveTenant('nope.tradon.app')).toBeNull();
  });
  it('returns null for inactive tenant', async () => {
    expect(await resolveTenant('rt-off.tradon.app')).toBeNull();
  });
  it('platform host resolves to null (not a tenant)', async () => {
    expect(await resolveTenant('app.tradon.app')).toBeNull();
  });
});
