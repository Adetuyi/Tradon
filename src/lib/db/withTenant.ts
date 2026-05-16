import { Pool, PoolClient } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Runs fn on a connection scoped to tenantId via RLS session var (as anon role). */
export async function withTenant<T>(
  tenantId: string, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query('set local role anon');
    await c.query(`select set_config('app.current_tenant_id',$1,true)`, [tenantId]);
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) { await c.query('rollback'); throw e; }
  finally { c.release(); }
}
