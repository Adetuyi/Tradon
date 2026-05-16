import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { provisionTenant } from '@/lib/provisioning/provisionTenant';

describe('provisionTenant', () => {
  it('creates tenant + subdomain + owner membership + audit', async () => {
    await q(`delete from tenants where slug='prov-x'`);
    const r = await provisionTenant({
      name: 'Prov X', slug: 'prov-x', ownerUserId: 'owner-1',
      region: 'NG', currency: 'NGN' });
    const [t] = await q(`select status from tenants where id=$1`, [r.tenantId]);
    expect(t.status).toBe('active');
    const [d] = await q(`select host,type from domains where tenant_id=$1`, [r.tenantId]);
    expect(d).toMatchObject({ host: 'prov-x.tradon.app', type: 'subdomain' });
    const [m] = await q(`select role from tenant_members
      where tenant_id=$1 and user_id='owner-1'`, [r.tenantId]);
    expect(m.role).toBe('Owner');
    const [a] = await q(`select action from audit_log where tenant_id=$1`, [r.tenantId]);
    expect(a.action).toBe('tenant.provisioned');
  });
  it('rejects duplicate slug', async () => {
    await expect(provisionTenant({ name:'Dup', slug:'prov-x',
      ownerUserId:'o', region:'NG', currency:'NGN' })).rejects.toThrow();
  });
});
