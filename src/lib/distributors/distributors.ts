import { withTenant } from '@/lib/db/withTenant';
import { writeAudit } from '@/lib/compliance/audit';

export const SHELL_PASSWORD_HASH = '!shell';

export type Distributor = {
  id: string; shop_user_id: string; business_name: string;
  region: string | null; address: string | null;
  credit_limit: string; outstanding: string; status: string;
};
export type CreateDistributorInput = {
  businessName: string; region?: string | null; address?: string | null;
  creditLimit?: number;
} & ( { shopUserId: string }
    | { shopUserId?: undefined; email: string; contactName: string } );

export async function createDistributor(
  tenantId: string, i: CreateDistributorInput): Promise<string> {
  return withTenant(tenantId, async c => {
    let shopUserId: string;
    if ('shopUserId' in i && i.shopUserId) {
      shopUserId = i.shopUserId;
    } else {
      const e = (i as { email:string }).email;
      const n = (i as { contactName:string }).contactName;
      shopUserId = (await c.query(
        `insert into shop_users(tenant_id,email,password_hash,full_name)
         values(current_tenant_id(),$1,$2,$3) returning id`,
        [e.toLowerCase(), SHELL_PASSWORD_HASH, n])).rows[0].id as string;
    }
    return (await c.query(
      `insert into distributors(tenant_id,shop_user_id,business_name,region,address,credit_limit)
       values(current_tenant_id(),$1,$2,$3,$4,$5) returning id`,
      [shopUserId, i.businessName, i.region ?? null, i.address ?? null,
       i.creditLimit ?? 0])).rows[0].id as string;
  });
}
export async function updateDistributor(tenantId: string, id: string,
  patch: { businessName?: string; region?: string | null; address?: string | null }) {
  const cols: string[] = []; const vals: unknown[] = []; let n = 1;
  const map: Record<string,string> = { businessName:'business_name',
    region:'region', address:'address' };
  for (const [k,v] of Object.entries(patch)) {
    if (v === undefined) continue; cols.push(`${map[k]}=$${n++}`); vals.push(v);
  }
  if (!cols.length) return;
  vals.push(id);
  await withTenant(tenantId, c => c.query(
    `update distributors set ${cols.join(',')}, updated_at=now() where id=$${n}`, vals));
}
export async function listDistributors(tenantId: string,
  f: { search?: string; status?: string }): Promise<Distributor[]> {
  return withTenant(tenantId, async c => {
    const w: string[] = []; const v: unknown[] = []; let n = 1;
    if (f.status) { w.push(`status=$${n++}`); v.push(f.status); }
    if (f.search) { w.push(`business_name ilike $${n}`); v.push(`%${f.search}%`); n++; }
    return (await c.query(
      `select id,shop_user_id,business_name,region,address,credit_limit,outstanding,status
       from distributors ${w.length?`where ${w.join(' and ')}`:''}
       order by business_name`, v)).rows;
  });
}
export async function getDistributor(tenantId: string, id: string): Promise<Distributor | null> {
  return withTenant(tenantId, async c => (await c.query(
    `select id,shop_user_id,business_name,region,address,credit_limit,outstanding,status
     from distributors where id=$1`, [id])).rows[0] ?? null);
}

export async function setCreditLimit(tenantId: string, id: string,
  newLimit: number, actor: string): Promise<void> {
  const old = await withTenant(tenantId, async c => {
    const r = (await c.query(
      `select credit_limit, outstanding from distributors where id=$1`, [id])).rows[0];
    if (!r) throw new Error('distributor not found');
    if (Number(newLimit) < Number(r.outstanding)) {
      throw new Error(`new limit ${newLimit} is below current outstanding ${r.outstanding}`);
    }
    await c.query(`update distributors set credit_limit=$2, updated_at=now() where id=$1`,
      [id, newLimit]);
    return Number(r.credit_limit);
  });
  await writeAudit({ tenantId, actor, action: 'distributor.credit_limit_changed',
    target: id, meta: { old, new: Number(newLimit) } });
}

const TRANSITIONS: Record<string, string[]> = {
  pending: ['active', 'archived'],
  active: ['suspended', 'archived'],
  suspended: ['active', 'archived'],
  archived: [],
};

export async function getDistributorContact(tenantId: string, shopUserId: string):
  Promise<{ email: string; full_name: string } | null> {
  return withTenant(tenantId, async c => (await c.query(
    `select email, full_name from shop_users where id=$1`, [shopUserId])).rows[0] ?? null);
}

export async function setStatus(tenantId: string, id: string,
  next: 'active'|'suspended'|'archived', actor: string): Promise<void> {
  await withTenant(tenantId, async c => {
    const cur = (await c.query(
      `select status, shop_user_id from distributors where id=$1`, [id])).rows[0];
    if (!cur) throw new Error('distributor not found');
    if (!TRANSITIONS[cur.status]?.includes(next)) {
      throw new Error(`invalid transition ${cur.status} -> ${next}`);
    }
    await c.query(`update distributors set status=$2, updated_at=now() where id=$1`,
      [id, next]);
    if (next === 'active') {
      await c.query(`update shop_users set status='distributor' where id=$1`,
        [cur.shop_user_id]);
    }
  });
  await writeAudit({ tenantId, actor, action: 'distributor.status_changed',
    target: id, meta: { to: next } });
}
