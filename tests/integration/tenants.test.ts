import { describe, it, expect, beforeAll } from 'vitest';
import { q } from '../helpers/db';

describe('tenants table', () => {
  beforeAll(async () => {
    await q(`delete from tenants where slug='acme-test'`);
  });

  it('stores tenant with NG defaults and UTC timestamps', async () => {
    const [t] = await q<{ id: string; currency: string; region: string; status: string }>(
      `insert into tenants (name, slug) values ('Acme','acme-test')
       returning id, currency, region, status`,
    );
    expect(t.currency).toBe('NGN');
    expect(t.region).toBe('NG');
    expect(t.status).toBe('active');

    const [{ tz }] = await q<{ tz: string }>(
      `select to_char(created_at,'TZ') tz from tenants where id=$1`,
      [t.id],
    );
    expect(tz).toBe('UTC');
  });
});
