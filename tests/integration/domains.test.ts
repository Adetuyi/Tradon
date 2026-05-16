import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';

describe('domains', () => {
  it('links host→tenant generically with a type discriminator', async () => {
    await q(`delete from tenants where slug='dom-test'`);
    const [t] = await q<{ id: string }>(
      `insert into tenants (name,slug) values ('Dom','dom-test') returning id`);
    await q(`insert into domains (tenant_id, host, type)
             values ($1,'dom-test.tradon.app','subdomain')`, [t.id]);
    const [row] = await q<{ tenant_id: string; type: string }>(
      `select tenant_id, type from domains where host=$1`, ['dom-test.tradon.app']);
    expect(row.tenant_id).toBe(t.id);
    expect(row.type).toBe('subdomain');
  });
});
