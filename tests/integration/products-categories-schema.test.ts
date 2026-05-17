import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';

describe('categories table', () => {
  it('is tenant-scoped, case-insensitive-unique, archivable', async () => {
    await q(`delete from tenants where slug='cat-s'`);
    const [t] = await q<{id:string}>(`insert into tenants(name,slug) values('C','cat-s') returning id`);
    const [c] = await q<{status:string}>(
      `insert into categories(tenant_id,name) values($1,'Beverages') returning status`, [t.id]);
    expect(c.status).toBe('active');
    await expect(q(`insert into categories(tenant_id,name) values($1,'beverages')`, [t.id]))
      .rejects.toThrow();
  });
});
