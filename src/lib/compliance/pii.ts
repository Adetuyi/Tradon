import { withTenant } from '@/lib/db/withTenant';

export async function exportUserData(tenantId: string, shopUserId: string) {
  return withTenant(tenantId, async (c) => {
    const u = (await c.query(
      `select id,email,full_name,phone,status,created_at
       from shop_users where id=$1`, [shopUserId])).rows[0];
    const consent = (await c.query(
      `select policy,version,accepted_at from policy_acceptance
       where subject=$1`, [`shop:${shopUserId}`])).rows;
    return { shop_user: u, consent };
  });
}

export async function eraseUserData(tenantId: string, shopUserId: string) {
  await withTenant(tenantId, async (c) => {
    await c.query(`delete from policy_acceptance where subject=$1`,
      [`shop:${shopUserId}`]);
    await c.query(`delete from shop_users where id=$1`, [shopUserId]);
  });
}
