import { Pool } from 'pg';

const CONN =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54332/postgres';

export const pool = new Pool({ connectionString: CONN });

export async function q<T = any>(sql: string, params: unknown[] = []) {
  const r = await pool.query(sql, params);
  return r.rows as T[];
}

export function assertOwnDatabase(): void {
  if (!CONN.includes(':54332/')) {
    const redacted = CONN.replace(/postgres:([^@]+)@/, 'postgres:***@');
    throw new Error(
      `Refusing destructive DB op: DATABASE_URL is not the f0-platform-foundation DB (expected port 54332). Got: ${redacted}`,
    );
  }
}

export async function resetTenancy() {
  assertOwnDatabase();
  await pool
    .query(
      `truncate table tenant_members, shop_users, domains, tenants
    restart identity cascade`,
    )
    .catch(() => {});
}
