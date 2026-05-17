import { withTenant } from '@/lib/db/withTenant';

export type Category = { id: string; name: string; status: string };

export async function createCategory(tenantId: string, name: string): Promise<string> {
  return withTenant(tenantId, async c => (await c.query(
    `insert into categories(tenant_id,name) values(current_tenant_id(),$1) returning id`,
    [name.trim()])).rows[0].id);
}
export async function renameCategory(tenantId: string, id: string, name: string): Promise<void> {
  await withTenant(tenantId, c => c.query(
    `update categories set name=$2, updated_at=now() where id=$1`, [id, name.trim()]));
}
export async function archiveCategory(tenantId: string, id: string): Promise<void> {
  await withTenant(tenantId, c => c.query(
    `update categories set status='archived', updated_at=now() where id=$1`, [id]));
}
export async function listCategories(tenantId: string): Promise<Category[]> {
  return withTenant(tenantId, async c => (await c.query(
    `select id,name,status from categories where status='active' order by name`)).rows);
}
export async function getOrCreateCategory(tenantId: string, name: string): Promise<string> {
  const n = name.trim();
  return withTenant(tenantId, async c => {
    const hit = await c.query(
      `select id from categories where lower(name)=lower($1)`, [n]);
    if (hit.rows[0]) return hit.rows[0].id as string;
    return (await c.query(
      `insert into categories(tenant_id,name) values(current_tenant_id(),$1) returning id`,
      [n])).rows[0].id as string;
  });
}
