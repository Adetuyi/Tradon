import { describe, it, expect } from 'vitest';
import { Pool } from 'pg';

describe('tenants registry is locked down from the shared anon role', () => {
  it('anon cannot select/insert/update/delete/truncate tenants', async () => {
    const c = await new Pool({ connectionString: process.env.DATABASE_URL }).connect();
    try {
      await c.query(`set role anon`);
      await expect(c.query(`select count(*) from tenants`)).rejects.toThrow(/permission denied/i);
      await expect(c.query(`insert into tenants(name,slug) values('x','x-lock')`)).rejects.toThrow(/permission denied/i);
      await expect(c.query(`update tenants set name='y'`)).rejects.toThrow(/permission denied/i);
      await expect(c.query(`delete from tenants`)).rejects.toThrow(/permission denied/i);
      await expect(c.query(`truncate tenants`)).rejects.toThrow(/permission denied/i);
    } finally {
      await c.query(`reset role`).catch(()=>{});
      c.release();
    }
  });
});
