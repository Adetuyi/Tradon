import { Pool } from 'pg';

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:54332/postgres',
});

export async function q<T = any>(sql: string, params: unknown[] = []) {
  const r = await pool.query(sql, params);
  return r.rows as T[];
}

export async function resetTenancy() {
  await pool
    .query(
      `truncate table tenant_members, shop_users, domains, tenants
    restart identity cascade`,
    )
    .catch(() => {});
}
