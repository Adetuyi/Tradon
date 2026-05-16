import bcrypt from 'bcryptjs';
import { withTenant } from '@/lib/db/withTenant';

export async function registerShopUser(
  tenantId: string, email: string, password: string, fullName: string, phone?: string) {
  const hash = await bcrypt.hash(password, 10);
  return withTenant(tenantId, async (c) => {
    const r = await c.query(
      `insert into shop_users(tenant_id,email,password_hash,full_name,phone)
       values(current_tenant_id(),$1,$2,$3,$4) returning id`,
      [email.toLowerCase(), hash, fullName, phone ?? null]);
    return r.rows[0].id as string;
  });
}

export async function verifyShopLogin(
  tenantId: string, email: string, password: string) {
  return withTenant(tenantId, async (c) => {
    const r = await c.query(
      `select id,password_hash,email from shop_users where email=$1`,
      [email.toLowerCase()]);
    if (!r.rows[0]) return null;
    const ok = await bcrypt.compare(password, r.rows[0].password_hash);
    return ok ? { id: r.rows[0].id as string, email: r.rows[0].email as string } : null;
  });
}
