# Distributors & Credits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship tenant-side distributor management + an auditable credit system on the F0/Products foundation — a `distributors` entity (1:1 with a per-tenant shop_user) with a lifecycle status machine, an append-only `credit_movements` ledger with DB-enforced drift-free `outstanding` bounded by `credit_limit`, RBAC-gated actions, and the distributors/credit UI.

**Architecture:** Reuse F0 + Products exactly. Every tenant-owned table gets `tenant_id` + an RLS policy referencing `current_tenant_id()` (the F0 `rls-guard` test fails the build otherwise). Tenant-scoped DB work goes through `withTenant`. Credit changes flow through one `record_credit_movement` SQL function whose trigger makes ledger↔`outstanding` drift structurally impossible and whose `0 ≤ outstanding ≤ credit_limit` CHECK + active-status guard are DB-enforced — a direct port of Products' `record_stock_movement`. `credit_limit` changes are audited via F0 `writeAudit` (not the ledger). UI renders in the F0 `AppShell` with Field Green tokens.

**Tech Stack:** Next.js 16 App Router (TS), Supabase (local DB **port 54332**, never 54322), `pg`/Vitest (`fileParallelism:false`, loads `.env.local`), Tailwind v3 (Field Green tokens), on `master` (no worktree).

**Spec:** `docs/superpowers/specs/2026-05-18-distributors-credits-design.md`
**Builds on (do not modify):** F0 + Products — `src/lib/db/withTenant.ts`, `src/lib/rbac/can.ts`, `src/lib/auth/staff.ts`, `src/lib/tenancy/resolveTenant.ts`, `src/lib/compliance/audit.ts` (`writeAudit`), `src/components/ui/{AppShell,Button,Input,Badge,Alert}.tsx`, `tests/helpers/db.ts` (`q`), migrations `0001..0017`.

**Conventions:** every code step is TDD (red → green → commit). Conventional Commits. No raw hex in components — semantic Tailwind tokens only. New tenant-owned table ⇒ `tenant_id` + RLS policy in the same migration or the F0 `rls-guard` fails. Migrations additive, next number is `0018`. A `'use server'` file may export ONLY async functions (Next 16) — permission-key constants live in a plain module.

---

## File Structure

```
supabase/migrations/
  0018_distributors.sql            # distributors table + RLS
  0019_credit_movements.sql        # append-only ledger + RLS (F0 audit pattern, FK-free tenant_id)
  0020_record_credit_movement.sql  # fn + trigger + status/limit guards
src/lib/distributors/
  distributors.ts                  # create/update/list/get + setStatus + setCreditLimit
  credit.ts                        # recordCreditMovement / listCreditMovements
  stats.ts                         # distributorStats
src/app/(tenant)/app/distributors/
  permissions.ts                   # PERM constants (plain module, NOT 'use server')
  actions.ts                       # RBAC-gated server actions
  page.tsx                         # list + stat cards + status filter
  [id]/page.tsx                    # distributor detail (profile + credit panel + ledger)
  DistributorForm.tsx              # 'use client' create/edit drawer
  CreditPanel.tsx                  # 'use client' set-limit / repayment / adjustment
  StatusActions.tsx                # 'use client' approve/reject/suspend/reactivate/archive
tests/integration/  distributors-*.test.ts, credit-*.test.ts, e2e-distributors.test.ts
tests/unit/         distributors-actions-guard.test.ts
design/distributors/Tradon Distributors — UI.html   # approved design reference (Task 1)
```

---

## Task 1: Design-first UI (GATED — human approval before UI tasks)

**Orchestrator/human gate, not a coding task.** Distributors screens need an approved static design before Tasks 11–13, exactly as F0/Products did.

**Files:** Create `design/distributors/Tradon Distributors — UI.html`

- [ ] **Step 1:** Produce a static, no-external-script HTML design rendered inside the F0 AppShell, Field Green tokens only, responsive: (a) Distributors list — stat cards (Active / Pending / Total outstanding / Over-limit), filterable table (business name, region, status badge, credit limit, outstanding, available), row actions incl. Approve/Reject for pending; (b) Distributor detail — profile, credit panel (limit + inline edit, outstanding, available), credit-movement ledger, action buttons (set limit, repayment, adjustment, suspend/reactivate/archive); (c) Create/edit distributor drawer; (d) Record-credit drawer (type: repayment/adjustment, amount, reason).
- [ ] **Step 2:** Present to the user; iterate to approval. **HARD CHECKPOINT: do not start Task 11 until the user approves this file.** Backend Tasks 2–10 + E2E do NOT depend on it and proceed first.
- [ ] **Step 3:** Commit: `git add "design/distributors" && git commit -m "design: approved Distributors & credits UI reference"`

---

## Task 2: `distributors` table

**Files:** Create `supabase/migrations/0018_distributors.sql`, `tests/integration/distributors-schema.test.ts`

- [ ] **Step 1: Failing test**

`tests/integration/distributors-schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';

describe('distributors table', () => {
  it('tenant-scoped, 1:1 shop_user, status default pending, outstanding bounded by limit', async () => {
    await q(`delete from tenants where slug='dst-s'`);
    const [t] = await q<{id:string}>(`insert into tenants(name,slug) values('D','dst-s') returning id`);
    const [su] = await q<{id:string}>(
      `insert into shop_users(tenant_id,email,password_hash,full_name)
       values($1,'d@x.com','!shell','D Biz') returning id`, [t.id]);
    const [d] = await q<{status:string;outstanding:string}>(
      `insert into distributors(tenant_id,shop_user_id,business_name,credit_limit)
       values($1,$2,'D Biz',1000) returning status,outstanding`, [t.id, su.id]);
    expect(d.status).toBe('pending');
    expect(Number(d.outstanding)).toBe(0);
    await expect(q(`insert into distributors(tenant_id,shop_user_id,business_name)
      values($1,$2,'dup')`, [t.id, su.id])).rejects.toThrow(); // unique(tenant,shop_user)
    await expect(q(`update distributors set outstanding=2000 where tenant_id=$1`, [t.id]))
      .rejects.toThrow(); // outstanding <= credit_limit (1000)
    await expect(q(`update distributors set outstanding=-1 where tenant_id=$1`, [t.id]))
      .rejects.toThrow(); // outstanding >= 0
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm vitest run tests/integration/distributors-schema.test.ts`
Expected: FAIL — relation "distributors" does not exist.

- [ ] **Step 3: Migration `supabase/migrations/0018_distributors.sql`**

```sql
create table distributors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  shop_user_id uuid not null references shop_users(id),
  business_name text not null,
  region text,
  address text,
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  outstanding numeric(14,2) not null default 0
    check (outstanding >= 0 and outstanding <= credit_limit),
  status text not null check (status in ('pending','active','suspended','archived'))
    default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, shop_user_id)
);
create index distributors_tenant_idx on distributors (tenant_id);
alter table distributors enable row level security;
create policy distributors_iso on distributors
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
grant select, insert, update on distributors to anon;
```

- [ ] **Step 4: Apply + verify PASS**

Run: `pnpm dlx supabase@latest db reset && pnpm vitest run tests/integration/distributors-schema.test.ts tests/integration/rls-guard.test.ts`
Expected: both PASS (rls-guard stays green — distributors RLS-protected).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0018_distributors.sql tests/integration/distributors-schema.test.ts
git commit -m "feat: distributors table (tenant-scoped, RLS, status, credit bounds)"
```

---

## Task 3: `credit_movements` append-only ledger

**Files:** Create `supabase/migrations/0019_credit_movements.sql`, `tests/integration/credit-movements-schema.test.ts`

- [ ] **Step 1: Failing test** (mirrors F0 audit / Products stock append-only)

`tests/integration/credit-movements-schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { q } from '../helpers/db';

describe('credit_movements append-only', () => {
  it('insert ok; update/delete no-op; truncate denied to anon', async () => {
    await q(`delete from tenants where slug='cm-s'`);
    const [t] = await q<{id:string}>(`insert into tenants(name,slug) values('C','cm-s') returning id`);
    const [su] = await q<{id:string}>(
      `insert into shop_users(tenant_id,email,password_hash,full_name)
       values($1,'c@x.com','!shell','C') returning id`, [t.id]);
    const [d] = await q<{id:string}>(
      `insert into distributors(tenant_id,shop_user_id,business_name,credit_limit)
       values($1,$2,'C',5000) returning id`, [t.id, su.id]);
    await q(`insert into credit_movements(tenant_id,distributor_id,type,delta,actor)
             values($1,$2,'purchase_draw',100,'u1')`, [t.id, d.id]);
    await q(`update credit_movements set delta=999 where tenant_id=$1`, [t.id]);
    const [m] = await q(`select delta from credit_movements where tenant_id=$1`, [t.id]);
    expect(Number(m.delta)).toBe(100);
    await q(`delete from credit_movements where tenant_id=$1`, [t.id]);
    const [{n}] = await q<{n:number}>(
      `select count(*)::int n from credit_movements where tenant_id=$1`, [t.id]);
    expect(n).toBe(1);
    const c = await new Pool({ connectionString: process.env.DATABASE_URL }).connect();
    try {
      await c.query(`set role anon`);
      await expect(c.query(`truncate credit_movements`)).rejects.toThrow(/permission denied/i);
    } finally { await c.query(`reset role`).catch(()=>{}); c.release(); }
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm vitest run tests/integration/credit-movements-schema.test.ts`
Expected: FAIL — relation "credit_movements" does not exist.

- [ ] **Step 3: Migration `supabase/migrations/0019_credit_movements.sql`**

```sql
create table credit_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  distributor_id uuid not null references distributors(id),
  type text not null check (type in ('purchase_draw','repayment','adjustment')),
  delta numeric(14,2) not null check (delta <> 0),
  reason text,
  actor text not null,
  created_at timestamptz not null default now()
);
create index credit_movements_tdc_idx on credit_movements (tenant_id, distributor_id, created_at);
alter table credit_movements enable row level security;
create policy credit_movements_iso on credit_movements
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
revoke update, delete on credit_movements from anon, authenticated;
grant select, insert on credit_movements to anon;
create rule credit_movements_no_update as on update to credit_movements do instead nothing;
create rule credit_movements_no_delete as on delete to credit_movements do instead nothing;
revoke truncate on credit_movements from anon, authenticated, service_role;
```
(Note: `tenant_id` is intentionally FK-free — an `on delete cascade` FK + `do instead nothing` delete rule conflict in Postgres, per the F0 `audit_log` precedent. Integrity is enforced by `record_credit_movement` validating the distributor's tenant.)

- [ ] **Step 4: Apply + verify PASS**

Run: `pnpm dlx supabase@latest db reset && pnpm vitest run tests/integration/credit-movements-schema.test.ts tests/integration/rls-guard.test.ts`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0019_credit_movements.sql tests/integration/credit-movements-schema.test.ts
git commit -m "feat: append-only credit_movements ledger (RLS, F0 audit pattern)"
```

---

## Task 4: `record_credit_movement` function + drift/limit/status guards

**Files:** Create `supabase/migrations/0020_record_credit_movement.sql`, `tests/integration/credit-integrity.test.ts`

- [ ] **Step 1: Failing test**

`tests/integration/credit-integrity.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { withTenant } from '@/lib/db/withTenant';

async function seed(slug:string, status='active', limit=1000){
  await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('X',$1) returning id`,[slug]);
  const [su]=await q<{id:string}>(`insert into shop_users(tenant_id,email,password_hash,full_name)
    values($1,$2,'!shell','B') returning id`,[t.id, `${slug}@x.com`]);
  const [d]=await q<{id:string}>(`insert into distributors(tenant_id,shop_user_id,business_name,
    credit_limit,status) values($1,$2,'B',$3,$4) returning id`,[t.id,su.id,limit,status]);
  return { tid:t.id, did:d.id };
}

describe('record_credit_movement integrity', () => {
  it('atomically updates ledger + outstanding', async () => {
    const { tid, did } = await seed('ci-a');
    await withTenant(tid, c => c.query(
      `select record_credit_movement($1,'purchase_draw',300,'order','u1')`,[did]));
    const [d]=await q<{outstanding:string}>(`select outstanding from distributors where id=$1`,[did]);
    const [{n}]=await q<{n:number}>(`select count(*)::int n from credit_movements where distributor_id=$1`,[did]);
    expect(Number(d.outstanding)).toBe(300); expect(n).toBe(1);
  });
  it('rejects an over-limit draw (tx aborts, outstanding unchanged)', async () => {
    const { tid, did } = await seed('ci-b', 'active', 500);
    await withTenant(tid, c => c.query(`select record_credit_movement($1,'purchase_draw',400,null,'u1')`,[did]));
    await expect(withTenant(tid, c =>
      c.query(`select record_credit_movement($1,'purchase_draw',200,null,'u1')`,[did])
    )).rejects.toThrow();
    const [d]=await q<{outstanding:string}>(`select outstanding from distributors where id=$1`,[did]);
    expect(Number(d.outstanding)).toBe(400);
  });
  it('rejects purchase_draw when not active; allows repayment when suspended', async () => {
    const { tid, did } = await seed('ci-c', 'suspended', 1000);
    await expect(withTenant(tid, c =>
      c.query(`select record_credit_movement($1,'purchase_draw',100,null,'u1')`,[did])
    )).rejects.toThrow(/active/i);
    // give it some debt via adjustment (allowed when suspended), then repay
    await withTenant(tid, c => c.query(`select record_credit_movement($1,'adjustment',100,'opening','u1')`,[did]));
    await withTenant(tid, c => c.query(`select record_credit_movement($1,'repayment',-60,'paid','u1')`,[did]));
    const [d]=await q<{outstanding:string}>(`select outstanding from distributors where id=$1`,[did]);
    expect(Number(d.outstanding)).toBe(40);
  });
  it('blocks a direct credit_movements insert (drift impossible)', async () => {
    const { tid, did } = await seed('ci-d');
    await expect(withTenant(tid, c => c.query(
      `insert into credit_movements(tenant_id,distributor_id,type,delta,actor)
       values(current_tenant_id(),$1,'purchase_draw',5,'u1')`,[did]
    ))).rejects.toThrow(/record_credit_movement/i);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm vitest run tests/integration/credit-integrity.test.ts`
Expected: FAIL — function `record_credit_movement` does not exist.

- [ ] **Step 3: Migration `supabase/migrations/0020_record_credit_movement.sql`**

```sql
create or replace function record_credit_movement(
  p_distributor_id uuid, p_type text, p_delta numeric,
  p_reason text, p_actor text)
returns void language plpgsql security definer
set search_path = public as $$
declare v_tenant uuid := current_tenant_id(); v_status text;
begin
  if v_tenant is null then raise exception 'no tenant context'; end if;
  select status into v_status from distributors
    where id = p_distributor_id and tenant_id = v_tenant;
  if not found then raise exception 'distributor not found'; end if;
  if p_type = 'purchase_draw' and v_status <> 'active' then
    raise exception 'distributor must be active for a purchase draw (is %)', v_status;
  end if;
  if v_status = 'archived' then raise exception 'distributor is archived'; end if;

  perform set_config('app.allow_credit_movement','1', true);
  insert into credit_movements(tenant_id,distributor_id,type,delta,reason,actor)
    values (v_tenant,p_distributor_id,p_type,p_delta,p_reason,p_actor);
  perform set_config('app.allow_credit_movement','', true);

  update distributors set outstanding = outstanding + p_delta, updated_at = now()
    where id = p_distributor_id and tenant_id = v_tenant;
end $$;

create or replace function credit_movements_guard() returns trigger
language plpgsql as $$
begin
  if current_user = 'anon'
     and coalesce(current_setting('app.allow_credit_movement', true),'') <> '1' then
    raise exception 'credit_movements may only be written via record_credit_movement';
  end if;
  return new;
end $$;

create trigger credit_movements_guard_trg
  before insert on credit_movements
  for each row execute function credit_movements_guard();

grant execute on function record_credit_movement(uuid,text,numeric,text,text) to anon;
```
(Over-limit / negative `outstanding` abort via the `distributors` `outstanding >= 0 and outstanding <= credit_limit` CHECK from Task 2 inside this function's transaction. The anon-scoped guard + transaction-local flag exactly mirror Products' `record_stock_movement`/`stock_movements_guard`; the schema test in Task 3 seeds a raw row as superuser `postgres`, which the `current_user='anon'` check intentionally permits.)

- [ ] **Step 4: Apply + verify PASS**

Run: `pnpm dlx supabase@latest db reset && pnpm vitest run tests/integration/credit-integrity.test.ts tests/integration/rls-guard.test.ts`
Expected: both PASS (4 integrity cases green).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0020_record_credit_movement.sql tests/integration/credit-integrity.test.ts
git commit -m "feat: record_credit_movement fn + trigger (drift/over-limit/status guards)"
```

---

## Task 5: `distributors.ts` — create/update/list/get

**Files:** Create `src/lib/distributors/distributors.ts`, `tests/integration/distributors-domain.test.ts`

- [ ] **Step 1: Failing test**

`tests/integration/distributors-domain.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createDistributor, updateDistributor, listDistributors, getDistributor }
  from '@/lib/distributors/distributors';

async function tid(slug:string){ await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('D',$1) returning id`,[slug]);
  return t.id; }

describe('distributors domain — create/update/list/get', () => {
  it('creates with a shell shop_user and via an existing shop_user', async () => {
    const t = await tid('dd-1');
    const id1 = await createDistributor(t, { businessName:'Acme Dist',
      email:'acme@x.com', contactName:'Ada', region:'Lagos', creditLimit:5000 });
    const d1 = await getDistributor(t, id1);
    expect(d1!.status).toBe('pending');
    expect(Number(d1!.credit_limit)).toBe(5000);
    const [su] = await q<{id:string}>(`select id from shop_users where id=$1`,[d1!.shop_user_id]);
    expect(su.id).toBe(d1!.shop_user_id); // shell shop_user created
    const [{ph}] = await q<{ph:string}>(`select password_hash ph from shop_users where id=$1`,
      [d1!.shop_user_id]);
    expect(ph).toBe('!shell');
    // existing shop_user path
    const [su2] = await q<{id:string}>(`insert into shop_users(tenant_id,email,password_hash,full_name)
      values($1,'ex@x.com','hash','Ex') returning id`,[t]);
    const id2 = await createDistributor(t, { shopUserId: su2.id, businessName:'Ex Dist' });
    expect((await getDistributor(t,id2))!.shop_user_id).toBe(su2.id);
    await updateDistributor(t, id1, { region:'Oyo' });
    expect((await getDistributor(t,id1))!.region).toBe('Oyo');
    const list = await listDistributors(t, {});
    expect(list.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm vitest run tests/integration/distributors-domain.test.ts`
Expected: FAIL — cannot resolve `@/lib/distributors/distributors`.

- [ ] **Step 3: Implement `src/lib/distributors/distributors.ts`**

```ts
import { withTenant } from '@/lib/db/withTenant';

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
```

- [ ] **Step 4: Run, verify PASS**

Run: `pnpm vitest run tests/integration/distributors-domain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/distributors/distributors.ts tests/integration/distributors-domain.test.ts
git commit -m "feat: distributors domain — create (shell/existing), update, list, get"
```

---

## Task 6: `setStatus` — lifecycle state machine

**Files:** Modify `src/lib/distributors/distributors.ts`; Create `tests/integration/distributors-status.test.ts`

- [ ] **Step 1: Failing test**

`tests/integration/distributors-status.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createDistributor, setStatus, getDistributor } from '@/lib/distributors/distributors';

async function tid(slug:string){ await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('D',$1) returning id`,[slug]);
  return t.id; }

describe('distributor status machine', () => {
  it('valid transitions; activate sets shop_users.status; invalid raises; archived terminal', async () => {
    const t = await tid('ds-1');
    const id = await createDistributor(t, { businessName:'S', email:'s@x.com',
      contactName:'S', creditLimit:100 });
    const d = await getDistributor(t, id);
    await expect(setStatus(t, id, 'suspended', 'u1')).rejects.toThrow(); // pending->suspended invalid
    await setStatus(t, id, 'active', 'u1');                              // pending->active ok
    const [su] = await q<{status:string}>(`select status from shop_users where id=$1`,
      [d!.shop_user_id]);
    expect(su.status).toBe('distributor');
    await setStatus(t, id, 'suspended', 'u1');                           // active->suspended ok
    await setStatus(t, id, 'active', 'u1');                              // suspended->active ok
    await setStatus(t, id, 'archived', 'u1');                            // active->archived ok
    await expect(setStatus(t, id, 'active', 'u1')).rejects.toThrow();    // archived terminal
    // audit written for a transition
    const [a] = await q(`select action from audit_log where tenant_id=$1
      and action='distributor.status_changed' limit 1`,[t]);
    expect(a.action).toBe('distributor.status_changed');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm vitest run tests/integration/distributors-status.test.ts`
Expected: FAIL — `setStatus` not exported.

- [ ] **Step 3: Append to `src/lib/distributors/distributors.ts`**

```ts
import { writeAudit } from '@/lib/compliance/audit';

const TRANSITIONS: Record<string, string[]> = {
  pending: ['active', 'archived'],
  active: ['suspended', 'archived'],
  suspended: ['active', 'archived'],
  archived: [],
};

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
```

- [ ] **Step 4: Run, verify PASS**

Run: `pnpm vitest run tests/integration/distributors-status.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/distributors/distributors.ts tests/integration/distributors-status.test.ts
git commit -m "feat: distributor status machine (transitions, activate→shop_user, audit)"
```

---

## Task 7: `setCreditLimit` — audited, bounded by outstanding

**Files:** Modify `src/lib/distributors/distributors.ts`; Create `tests/integration/distributors-creditlimit.test.ts`

- [ ] **Step 1: Failing test**

`tests/integration/distributors-creditlimit.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createDistributor, setStatus, setCreditLimit, getDistributor }
  from '@/lib/distributors/distributors';
import { recordCreditMovement } from '@/lib/distributors/credit';

async function tid(slug:string){ await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('D',$1) returning id`,[slug]);
  return t.id; }

describe('setCreditLimit', () => {
  it('updates limit, audits old/new, rejects a limit below outstanding', async () => {
    const t = await tid('dl-1');
    const id = await createDistributor(t,{ businessName:'L',email:'l@x.com',
      contactName:'L',creditLimit:1000 });
    await setStatus(t, id, 'active', 'u1');
    await recordCreditMovement(t,{ distributorId:id, type:'purchase_draw',
      delta:600, actor:'u1' });
    await setCreditLimit(t, id, 2000, 'u1');
    expect(Number((await getDistributor(t,id))!.credit_limit)).toBe(2000);
    const [a] = await q(`select meta from audit_log where tenant_id=$1
      and action='distributor.credit_limit_changed' order by created_at desc limit 1`,[t]);
    expect(a.meta.old).toBe(1000); expect(a.meta.new).toBe(2000);
    await expect(setCreditLimit(t, id, 500, 'u1')).rejects.toThrow(/outstanding/i); // 500 < 600
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm vitest run tests/integration/distributors-creditlimit.test.ts`
Expected: FAIL — `setCreditLimit` not exported (and/or `recordCreditMovement` — Task 8 implements it; if missing, this test stays red until Task 8; run it again at the end of Task 8 too).

- [ ] **Step 3: Append to `src/lib/distributors/distributors.ts`**

```ts
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
```

- [ ] **Step 4: Run, verify PASS** (depends on Task 8's `recordCreditMovement`)

Run: `pnpm vitest run tests/integration/distributors-creditlimit.test.ts`
Expected: PASS once Task 8 lands. If Task 8 not yet done, implement Task 8 first then return here; the test is authored now (TDD) and must be green before this task's commit.

- [ ] **Step 5: Commit**

```bash
git add src/lib/distributors/distributors.ts tests/integration/distributors-creditlimit.test.ts
git commit -m "feat: setCreditLimit (audited old/new, rejects limit < outstanding)"
```

---

## Task 8: `credit.ts` — record/list credit movements + concurrency

**Files:** Create `src/lib/distributors/credit.ts`, `tests/integration/credit-domain.test.ts`

- [ ] **Step 1: Failing test**

`tests/integration/credit-domain.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createDistributor, setStatus } from '@/lib/distributors/distributors';
import { recordCreditMovement, listCreditMovements } from '@/lib/distributors/credit';

async function tid(slug:string){ await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('C',$1) returning id`,[slug]);
  return t.id; }

describe('credit domain', () => {
  it('records movements; concurrent draws stay drift-free and within limit', async () => {
    const t = await tid('cd-1');
    const id = await createDistributor(t,{ businessName:'C',email:'c@x.com',
      contactName:'C',creditLimit:1000 });
    await setStatus(t, id, 'active', 'u1');
    // 20 concurrent draws of 50 = 1000 exactly (at the limit)
    const res = await Promise.allSettled(Array.from({length:20}, () =>
      recordCreditMovement(t,{ distributorId:id, type:'purchase_draw', delta:50, actor:'u1' })));
    const ok = res.filter(r=>r.status==='fulfilled').length;
    const [d]=await q<{outstanding:string}>(`select outstanding from distributors where id=$1`,[id]);
    const mv = await listCreditMovements(t, id);
    const sum = mv.reduce((s,m)=>s+Number(m.delta),0);
    expect(Number(d.outstanding)).toBe(ok*50);   // cache == accepted draws
    expect(sum).toBe(ok*50);                      // ledger == cache (no drift)
    expect(Number(d.outstanding)).toBeLessThanOrEqual(1000); // never over limit
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm vitest run tests/integration/credit-domain.test.ts`
Expected: FAIL — cannot resolve `@/lib/distributors/credit`.

- [ ] **Step 3: Implement `src/lib/distributors/credit.ts`**

```ts
import { withTenant } from '@/lib/db/withTenant';

export type CreditType = 'purchase_draw'|'repayment'|'adjustment';
export type CreditMovement = { id:string; type:CreditType; delta:string;
  reason:string|null; actor:string; created_at:string };

export async function recordCreditMovement(tenantId: string, m: {
  distributorId: string; type: CreditType; delta: number;
  reason?: string | null; actor: string;
}): Promise<void> {
  await withTenant(tenantId, c => c.query(
    `select record_credit_movement($1,$2,$3,$4,$5)`,
    [m.distributorId, m.type, m.delta, m.reason ?? null, m.actor]));
}
export async function listCreditMovements(tenantId: string,
  distributorId: string): Promise<CreditMovement[]> {
  return withTenant(tenantId, async c => (await c.query(
    `select id,type,delta,reason,actor,created_at from credit_movements
     where distributor_id=$1 order by created_at desc`, [distributorId])).rows);
}
```

- [ ] **Step 4: Run, verify PASS** (also re-run Task 7's test now)

Run: `pnpm vitest run tests/integration/credit-domain.test.ts tests/integration/distributors-creditlimit.test.ts`
Expected: both PASS (concurrent draws: accepted count × 50 == outstanding == ledger sum, ≤ 1000).

- [ ] **Step 5: Commit**

```bash
git add src/lib/distributors/credit.ts tests/integration/credit-domain.test.ts
git commit -m "feat: credit domain (recordCreditMovement, listCreditMovements, concurrency-safe)"
```

---

## Task 9: `stats.ts` — distributor header stats

**Files:** Create `src/lib/distributors/stats.ts`, `tests/integration/distributor-stats.test.ts`

- [ ] **Step 1: Failing test**

`tests/integration/distributor-stats.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createDistributor, setStatus } from '@/lib/distributors/distributors';
import { recordCreditMovement } from '@/lib/distributors/credit';
import { distributorStats } from '@/lib/distributors/stats';

describe('distributorStats', () => {
  it('counts active/pending, sums outstanding, flags over-limit', async () => {
    await q(`delete from tenants where slug='dst-1'`);
    const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('S','dst-1') returning id`);
    const a = await createDistributor(t.id,{ businessName:'A',email:'a@x.com',
      contactName:'A',creditLimit:1000 });
    await setStatus(t.id, a, 'active', 'u');
    await recordCreditMovement(t.id,{ distributorId:a, type:'purchase_draw', delta:1000, actor:'u' });
    await createDistributor(t.id,{ businessName:'B',email:'b@x.com',contactName:'B' }); // pending
    const s = await distributorStats(t.id);
    expect(s.totalActive).toBe(1);
    expect(s.pendingCount).toBe(1);
    expect(s.totalOutstanding).toBe(1000);
    expect(s.overLimitCount).toBe(1); // A at 1000/1000
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm vitest run tests/integration/distributor-stats.test.ts`
Expected: FAIL — cannot resolve `@/lib/distributors/stats`.

- [ ] **Step 3: Implement `src/lib/distributors/stats.ts`**

```ts
import { withTenant } from '@/lib/db/withTenant';

export type DistributorStats = { totalActive:number; pendingCount:number;
  totalOutstanding:number; overLimitCount:number };

export async function distributorStats(tenantId: string): Promise<DistributorStats> {
  return withTenant(tenantId, async c => {
    const r = (await c.query(`
      select
        count(*) filter (where status='active')::int as total_active,
        count(*) filter (where status='pending')::int as pending_count,
        coalesce(sum(outstanding) filter (where status <> 'archived'),0)::float8 as total_out,
        count(*) filter (where status='active'
          and outstanding >= credit_limit and credit_limit > 0)::int as over_limit
      from distributors`)).rows[0];
    return { totalActive: r.total_active, pendingCount: r.pending_count,
             totalOutstanding: r.total_out, overLimitCount: r.over_limit };
  });
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `pnpm vitest run tests/integration/distributor-stats.test.ts`
Expected: PASS (1 / 1 / 1000 / 1).

- [ ] **Step 5: Commit**

```bash
git add src/lib/distributors/stats.ts tests/integration/distributor-stats.test.ts
git commit -m "feat: distributor stats (active/pending counts, outstanding, over-limit)"
```

---

## Task 10: Permission constants + RBAC-gated server actions

**Files:** Create `src/app/(tenant)/app/distributors/permissions.ts`, `src/app/(tenant)/app/distributors/actions.ts`, `tests/unit/distributors-actions-guard.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/distributors-actions-guard.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { DISTRIBUTORS_READ, DISTRIBUTORS_WRITE }
  from '@/app/(tenant)/app/distributors/permissions';
describe('distributor permission keys', () => {
  it('reuses the F0 distributor permission keys', () => {
    expect(DISTRIBUTORS_READ).toBe('distributors.read');
    expect(DISTRIBUTORS_WRITE).toBe('distributors.write');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm vitest run tests/unit/distributors-actions-guard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `permissions.ts` (plain module — NOT 'use server')**

`src/app/(tenant)/app/distributors/permissions.ts`:
```ts
export const DISTRIBUTORS_READ = 'distributors.read';
export const DISTRIBUTORS_WRITE = 'distributors.write';
```

- [ ] **Step 4: Implement `src/app/(tenant)/app/distributors/actions.ts`**

```ts
'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { DISTRIBUTORS_READ, DISTRIBUTORS_WRITE } from './permissions';
import { createDistributor, updateDistributor, setStatus, setCreditLimit }
  from '@/lib/distributors/distributors';
import { recordCreditMovement, CreditType } from '@/lib/distributors/credit';

async function gate(perm: string) {
  const tenant = await resolveTenant((await headers()).get('host') ?? '');
  if (!tenant) redirect('/not-found-tenant');
  const session = await getStaffSession(tenant.id);
  if (!session) redirect('/login');
  const principal = session.membership
    ? { role: session.membership.role, isPlatform: false } : null;
  await requirePermission(principal, perm);
  return { tenantId: tenant.id, actor: session.userId };
}

export async function createDistributorAction(fd: FormData) {
  const { tenantId } = await gate(DISTRIBUTORS_WRITE);
  const shopUserId = (fd.get('shopUserId') as string) || undefined;
  await createDistributor(tenantId, shopUserId
    ? { shopUserId, businessName:String(fd.get('businessName')),
        region:(fd.get('region') as string)||null,
        creditLimit:Number(fd.get('creditLimit')||0) }
    : { businessName:String(fd.get('businessName')),
        email:String(fd.get('email')), contactName:String(fd.get('contactName')),
        region:(fd.get('region') as string)||null,
        creditLimit:Number(fd.get('creditLimit')||0) });
  revalidatePath('/app/distributors');
}
export async function updateDistributorAction(fd: FormData) {
  const { tenantId } = await gate(DISTRIBUTORS_WRITE);
  await updateDistributor(tenantId, String(fd.get('id')), {
    businessName:String(fd.get('businessName')),
    region:(fd.get('region') as string)||null,
    address:(fd.get('address') as string)||null });
  revalidatePath(`/app/distributors/${fd.get('id')}`);
}
export async function setStatusAction(fd: FormData) {
  const { tenantId, actor } = await gate(DISTRIBUTORS_WRITE);
  await setStatus(tenantId, String(fd.get('id')),
    String(fd.get('status')) as 'active'|'suspended'|'archived', actor);
  revalidatePath('/app/distributors');
}
export async function setCreditLimitAction(fd: FormData) {
  const { tenantId, actor } = await gate(DISTRIBUTORS_WRITE);
  await setCreditLimit(tenantId, String(fd.get('id')),
    Number(fd.get('creditLimit')), actor);
  revalidatePath(`/app/distributors/${fd.get('id')}`);
}
export async function recordCreditAction(fd: FormData) {
  const { tenantId, actor } = await gate(DISTRIBUTORS_WRITE);
  const type = String(fd.get('type')) as CreditType;
  const mag = Math.abs(Number(fd.get('amount')));
  if (!mag || Number.isNaN(mag)) throw new Error('amount required');
  if (type === 'purchase_draw') throw new Error('purchase draws come from Orders, not here');
  const reason = String(fd.get('reason') || '');
  // repayment reduces outstanding (negative); adjustment uses the signed direction
  const delta = type === 'repayment' ? -mag
    : (String(fd.get('direction')) === 'subtract' ? -mag : mag);
  await recordCreditMovement(tenantId, { distributorId:String(fd.get('id')),
    type, delta, reason: reason || null, actor });
  revalidatePath(`/app/distributors/${fd.get('id')}`);
}
```

- [ ] **Step 5: Run, verify PASS + full suite + build**

Run: `pnpm vitest run tests/unit/distributors-actions-guard.test.ts && pnpm test && pnpm build`
Expected: PASS; full suite green; build compiles.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(tenant)/app/distributors/permissions.ts" "src/app/(tenant)/app/distributors/actions.ts" tests/unit/distributors-actions-guard.test.ts
git commit -m "feat: RBAC-gated distributor + credit server actions"
```

---

## Task 11: Distributors list page (stat cards + table) — to approved design

**Files:** Create `src/app/(tenant)/app/distributors/page.tsx`

**Prereq:** Task 1 design approved.

- [ ] **Step 1: Implement `src/app/(tenant)/app/distributors/page.tsx`**

Server component; same auth/redirect order as F0 `/app`; renders in `AppShell`. Build to the approved `design/distributors/Tradon Distributors — UI.html` list screen.

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { AppShell } from '@/components/ui/AppShell';
import { listDistributors } from '@/lib/distributors/distributors';
import { distributorStats } from '@/lib/distributors/stats';

export const dynamic = 'force-dynamic';

export default async function DistributorsPage({ searchParams }:
  { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const tenant = await resolveTenant((await headers()).get('host') ?? '');
  if (!tenant) redirect('/not-found-tenant');
  const session = await getStaffSession(tenant.id);
  if (!session) redirect('/login');
  const principal = session.membership
    ? { role: session.membership.role, isPlatform: false } : null;
  await requirePermission(principal, 'distributors.read');

  const [stats, rows] = await Promise.all([
    distributorStats(tenant.id),
    listDistributors(tenant.id, { search: sp.q, status: sp.status }),
  ]);
  const fmt = (n: number) => '₦' + n.toLocaleString('en-NG');

  return (
    <AppShell tenantName={tenant.slug} role={session.membership!.role}>
      <div className="w-full max-w-[1100px]">
        <h1 className="font-display font-bold text-2xl text-ink mb-5">Distributors</h1>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          {[['Active', String(stats.totalActive), false],
            ['Pending', String(stats.pendingCount), false],
            ['Total outstanding', fmt(stats.totalOutstanding), false],
            ['Over-limit', String(stats.overLimitCount), true]].map(([l,v,warn]) => (
            <div key={l as string} className="bg-surface border border-hairline rounded-card p-5">
              <div className="text-[11px] uppercase tracking-wide text-muted">{l}</div>
              <div className={`font-display font-bold text-2xl mt-2 ${
                warn ? 'text-negative' : 'text-ink'}`}>{v}</div>
            </div>
          ))}
        </div>
        <div className="bg-surface border border-hairline rounded-card overflow-hidden">
          <div className="overflow-x-auto"><div className="min-w-[820px]">
            <div className="grid grid-cols-[1.8fr_1fr_0.8fr_0.9fr_0.9fr_0.9fr] bg-surface-2
              text-[10.5px] uppercase tracking-wide text-muted font-semibold">
              {['Business','Region','Status','Limit','Outstanding','Available'].map(h =>
                <div key={h} className="px-4 py-3">{h}</div>)}
            </div>
            {rows.length === 0 && (
              <div className="px-4 py-14 text-center text-muted text-sm">
                No distributors yet.</div>)}
            {rows.map(d => {
              const avail = Number(d.credit_limit) - Number(d.outstanding);
              const badge = d.status==='active' ? 'bg-green-50 text-primary-700 border-green-200'
                : d.status==='pending' ? 'bg-surface-2 text-signal border-hairline'
                : d.status==='suspended' ? 'bg-surface-2 text-negative border-hairline'
                : 'bg-surface-2 text-muted border-hairline';
              return (
              <Link key={d.id} href={`/app/distributors/${d.id}`}
                className="grid grid-cols-[1.8fr_1fr_0.8fr_0.9fr_0.9fr_0.9fr]
                border-t border-hairline text-[13px] items-center hover:bg-surface-2">
                <div className="px-4 py-3 text-ink font-medium">{d.business_name}</div>
                <div className="px-4 py-3 text-muted">{d.region ?? '—'}</div>
                <div className="px-4 py-3"><span className={`font-mono text-[10.5px]
                  px-2.5 py-1 rounded-full border ${badge}`}>{d.status}</span></div>
                <div className="px-4 py-3 font-mono text-muted">{fmt(Number(d.credit_limit))}</div>
                <div className="px-4 py-3 font-mono">{fmt(Number(d.outstanding))}</div>
                <div className="px-4 py-3 font-mono">{fmt(avail)}</div>
              </Link>
            );})}
          </div></div>
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Build + suite**

Run: `pnpm build && pnpm test`
Expected: build compiles (`/app/distributors` dynamic); full suite green.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(tenant)/app/distributors/page.tsx"
git commit -m "feat: distributors list page (stat cards + table) to approved design"
```

---

## Task 12: Distributor detail page (profile + credit panel + ledger) — to approved design

**Files:** Create `src/app/(tenant)/app/distributors/[id]/page.tsx`

**Prereq:** Task 1 design approved.

- [ ] **Step 1: Implement `src/app/(tenant)/app/distributors/[id]/page.tsx`**

Server component; auth/redirect order; renders in `AppShell`; loads distributor + ledger; renders profile, a credit panel, the movement history, and mounts the client action components (Task 13). Build to the approved detail screen.

```tsx
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { AppShell } from '@/components/ui/AppShell';
import { getDistributor } from '@/lib/distributors/distributors';
import { listCreditMovements } from '@/lib/distributors/credit';
import { CreditPanel } from '../CreditPanel';
import { StatusActions } from '../StatusActions';

export const dynamic = 'force-dynamic';

export default async function DistributorDetail({ params }:
  { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await resolveTenant((await headers()).get('host') ?? '');
  if (!tenant) redirect('/not-found-tenant');
  const session = await getStaffSession(tenant.id);
  if (!session) redirect('/login');
  const principal = session.membership
    ? { role: session.membership.role, isPlatform: false } : null;
  await requirePermission(principal, 'distributors.read');

  const d = await getDistributor(tenant.id, id);
  if (!d) notFound();
  const movements = await listCreditMovements(tenant.id, id);
  const fmt = (n: number) => '₦' + n.toLocaleString('en-NG');
  const available = Number(d.credit_limit) - Number(d.outstanding);

  return (
    <AppShell tenantName={tenant.slug} role={session.membership!.role}>
      <div className="w-full max-w-[860px]">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-ink">{d.business_name}</h1>
            <p className="text-sm text-muted mt-1">{d.region ?? '—'} ·
              <span className="font-mono ml-1">{d.status}</span></p>
          </div>
          <StatusActions id={d.id} status={d.status} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[['Credit limit', fmt(Number(d.credit_limit))],
            ['Outstanding', fmt(Number(d.outstanding))],
            ['Available', fmt(available)]].map(([l,v]) => (
            <div key={l} className="bg-surface border border-hairline rounded-card p-5">
              <div className="text-[11px] uppercase tracking-wide text-muted">{l}</div>
              <div className="font-display font-bold text-2xl text-ink mt-2">{v}</div>
            </div>
          ))}
        </div>
        <CreditPanel id={d.id} />
        <div className="bg-surface border border-hairline rounded-card overflow-hidden mt-6">
          <div className="px-4 py-3 bg-surface-2 text-[10.5px] uppercase tracking-wide
            text-muted font-semibold">Credit movements</div>
          {movements.length === 0 && (
            <div className="px-4 py-10 text-center text-muted text-sm">No movements yet.</div>)}
          {movements.map(m => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3
              border-t border-hairline text-[13px]">
              <span className="text-ink">{m.type}{m.reason ? ` · ${m.reason}` : ''}</span>
              <span className={`font-mono ${Number(m.delta) < 0
                ? 'text-positive' : 'text-negative'}`}>
                {Number(m.delta) > 0 ? '+' : ''}{fmt(Number(m.delta))}</span>
              <span className="font-mono text-[10.5px] text-faint">
                {new Date(m.created_at).toISOString().slice(0,10)}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Build + suite**

Run: `pnpm build && pnpm test`
Expected: build compiles (`/app/distributors/[id]` dynamic); suite green. (CreditPanel/StatusActions are created in Task 13 — if build fails on missing imports, do Task 13 first; these two tasks ship together. Order: implement Task 13's two client components, then this page, then commit both — see Task 13.)

- [ ] **Step 3: Commit** (combined with Task 13 — see Task 13 Step 4)

---

## Task 13: Client action components (status / credit / create-edit) — to approved design

**Files:** Create `src/app/(tenant)/app/distributors/StatusActions.tsx`, `src/app/(tenant)/app/distributors/CreditPanel.tsx`, `src/app/(tenant)/app/distributors/DistributorForm.tsx`; Modify `src/app/(tenant)/app/distributors/page.tsx` (mount `<DistributorForm>` "New distributor" + per-row Approve/Reject for pending)

**Prereq:** Task 1 design approved. Implement this BEFORE finishing Task 12's commit (Task 12's page imports CreditPanel + StatusActions).

- [ ] **Step 1: `StatusActions.tsx`** (`'use client'`) — buttons that submit `setStatusAction`, valid transitions only for the current status:
```tsx
'use client';
import { setStatusAction } from './actions';
import { buttonClass } from '@/components/ui/Button';

const NEXT: Record<string, {to:string;label:string;tone:'primary'|'secondary'|'danger'}[]> = {
  pending: [{to:'active',label:'Approve',tone:'primary'},
            {to:'archived',label:'Reject',tone:'danger'}],
  active: [{to:'suspended',label:'Suspend',tone:'secondary'},
           {to:'archived',label:'Archive',tone:'danger'}],
  suspended: [{to:'active',label:'Reactivate',tone:'primary'},
              {to:'archived',label:'Archive',tone:'danger'}],
  archived: [],
};
export function StatusActions({ id, status }: { id:string; status:string }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {(NEXT[status] ?? []).map(a => (
        <form key={a.to} action={setStatusAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={a.to} />
          <button type="submit" className={`h-9 px-4 text-xs ${buttonClass(a.tone)}`}>
            {a.label}</button>
        </form>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `CreditPanel.tsx`** (`'use client'`) — set-limit form + record repayment/adjustment (amount + Add/Subtract toggle for adjustment, mirroring the Products stock-adjust pattern the user approved):
```tsx
'use client';
import { useState } from 'react';
import { setCreditLimitAction, recordCreditAction } from './actions';
import { buttonClass } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function CreditPanel({ id }: { id:string }) {
  const [dir, setDir] = useState<'add'|'subtract'>('add');
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <form action={setCreditLimitAction}
        className="bg-surface border border-hairline rounded-card p-5">
        <input type="hidden" name="id" value={id} />
        <div className="font-display font-semibold text-sm text-ink mb-3">Set credit limit</div>
        <Input label="New limit (₦)" name="creditLimit" type="number" step="0.01" required />
        <button type="submit" className={`w-full ${buttonClass('primary')}`}>Update limit</button>
      </form>
      <form action={recordCreditAction}
        className="bg-surface border border-hairline rounded-card p-5">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="direction" value={dir} />
        <div className="font-display font-semibold text-sm text-ink mb-3">Record credit movement</div>
        <label className="block mb-4">
          <span className="block text-[11px] uppercase tracking-wide text-muted mb-[7px]">Type</span>
          <select name="type" className="h-[46px] w-full rounded-ctl border
            border-hairline-strong bg-surface px-3 text-sm text-ink">
            <option value="repayment">Repayment</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </label>
        <div className="mb-4">
          <span className="block text-[11px] uppercase tracking-wide text-muted mb-[7px]">Amount</span>
          <div className="flex gap-2.5">
            <input name="amount" type="number" min="0.01" step="0.01" required
              className="flex-1 h-[46px] rounded-ctl border border-hairline-strong
              bg-surface px-3 text-sm text-ink" />
            <div className="flex rounded-ctl border border-hairline-strong overflow-hidden shrink-0">
              {(['add','subtract'] as const).map((dd,i) => (
                <button type="button" key={dd} onClick={() => setDir(dd)}
                  className={`px-4 font-display font-semibold text-[12.5px] ${
                    i===1?'border-l border-hairline-strong':''} ${
                    dir===dd ? 'bg-primary text-on-primary':'bg-surface text-muted'}`}>
                  {dd==='add'?'Add':'Subtract'}</button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-faint mt-1">Repayment always reduces outstanding;
            Add/Subtract applies to Adjustment.</p>
        </div>
        <Input label="Reason" name="reason" />
        <button type="submit" className={`w-full ${buttonClass('primary')}`}>Record</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: `DistributorForm.tsx`** (`'use client'`) — create/edit drawer (designate existing shop_user OR create with email+contact), submitting `createDistributorAction`/`updateDistributorAction`:
```tsx
'use client';
import { useState } from 'react';
import { createDistributorAction } from './actions';
import { buttonClass } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function DistributorForm() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={buttonClass('primary')}>
        + New distributor</button>
      {open && (
        <div className="fixed inset-0 z-40 bg-ink/30 flex items-start justify-center
          p-0 sm:p-7 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-surface w-full sm:max-w-[420px] rounded-t-card sm:rounded-card
            p-6 max-h-[100dvh] sm:max-h-[92dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg text-ink mb-1">New distributor</h3>
            <p className="text-xs text-muted mb-4">Creates a pending distributor and a shop
              account shell (the distributor sets a password later).</p>
            <form action={createDistributorAction}>
              <Input label="Business name" name="businessName" required />
              <Input label="Contact name" name="contactName" required />
              <Input label="Contact email" name="email" type="email" required />
              <Input label="Region" name="region" />
              <Input label="Credit limit (₦)" name="creditLimit" type="number"
                step="0.01" defaultValue="0" />
              <button type="submit" className={`w-full ${buttonClass('primary')}`}>
                Create distributor</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Mount in `page.tsx`** — import `DistributorForm`; change the `<h1>Distributors</h1>` row to a flex header with `<DistributorForm />` on the right. Build + full suite, then commit Tasks 12+13 together:

Run: `pnpm build && pnpm test`
Expected: build compiles (`/app/distributors`, `/app/distributors/[id]` dynamic); suite green (~no new test files; existing 50+ tests stay green).

```bash
git add "src/app/(tenant)/app/distributors/[id]/page.tsx" "src/app/(tenant)/app/distributors/StatusActions.tsx" "src/app/(tenant)/app/distributors/CreditPanel.tsx" "src/app/(tenant)/app/distributors/DistributorForm.tsx" "src/app/(tenant)/app/distributors/page.tsx"
git commit -m "feat: distributor detail + status/credit/create client components to approved design"
```

## Rules for Tasks 11–13
- Match the approved `design/distributors/Tradon Distributors — UI.html`. Server components except the three `'use client'` action components. Semantic Tailwind tokens only — NO raw hex (`bg-ink/30` opacity modifier on a token is fine). Same auth/redirect order + `await requirePermission`. `pnpm build` must pass. Port 54332; `.env.local` untracked.

---

## Task 14: End-to-end + docs

**Files:** Create `tests/integration/e2e-distributors.test.ts`; Modify `docs/DEV.md`

- [ ] **Step 1: Failing/again-green E2E test**

`tests/integration/e2e-distributors.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createDistributor, setStatus, setCreditLimit, listDistributors }
  from '@/lib/distributors/distributors';
import { recordCreditMovement } from '@/lib/distributors/credit';
import { distributorStats } from '@/lib/distributors/stats';

describe('distributors & credits E2E + isolation', () => {
  it('create→approve→limit→draw→over-limit reject→repay→suspend blocks draw→archive; isolation', async () => {
    await q(`delete from tenants where slug in ('e2d-a','e2d-b')`);
    const [a]=await q<{id:string}>(`insert into tenants(name,slug) values('A','e2d-a') returning id`);
    const [b]=await q<{id:string}>(`insert into tenants(name,slug) values('B','e2d-b') returning id`);
    const id = await createDistributor(a.id,{ businessName:'Gari Co',
      email:'g@x.com', contactName:'G', region:'Kano', creditLimit:1000 });
    await setStatus(a.id, id, 'active', 'u1');
    await setCreditLimit(a.id, id, 2000, 'u1');
    await recordCreditMovement(a.id,{ distributorId:id, type:'purchase_draw',
      delta:1500, actor:'u1' });
    await expect(recordCreditMovement(a.id,{ distributorId:id, type:'purchase_draw',
      delta:600, actor:'u1' })).rejects.toThrow();              // 1500+600 > 2000
    await recordCreditMovement(a.id,{ distributorId:id, type:'repayment',
      delta:-500, reason:'paid', actor:'u1' });
    const [d]=await q<{outstanding:string}>(`select outstanding from distributors where id=$1`,[id]);
    expect(Number(d.outstanding)).toBe(1000);                   // 1500-500
    await setStatus(a.id, id, 'suspended', 'u1');
    await expect(recordCreditMovement(a.id,{ distributorId:id, type:'purchase_draw',
      delta:10, actor:'u1' })).rejects.toThrow(/active/i);      // suspended blocks draw
    const s = await distributorStats(a.id);
    expect(s.totalOutstanding).toBe(1000);
    // tenant B sees nothing
    expect(await listDistributors(b.id, {})).toEqual([]);
    await setStatus(a.id, id, 'archived', 'u1');
    expect((await listDistributors(a.id,{ status:'active' })).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run, verify PASS** (whole module proven)

Run: `pnpm vitest run tests/integration/e2e-distributors.test.ts`
Expected: PASS. If it FAILS, that is a real integration defect — STOP and report BLOCKED; do NOT weaken assertions.

- [ ] **Step 3: Append to `docs/DEV.md`** under Invariants:

```markdown
- Distributors: credit changes ONLY via `record_credit_movement` (a trigger blocks
  direct `credit_movements` writes by the app `anon` role); `distributors.outstanding`
  is DB-maintained, cannot drift, and is bounded `0 ≤ outstanding ≤ credit_limit`;
  `purchase_draw` requires `status='active'`. `credit_movements` is append-only
  (UPDATE/DELETE no-op, TRUNCATE revoked from app roles), RLS-scoped.
- `credit_limit` changes are recorded via F0 `audit_log` (writeAudit), not the ledger,
  and may not be set below current `outstanding`.
- Distributors archive (status), never hard-delete; lifecycle pending→active→
  suspended/archived enforced by `setStatus`.
```

- [ ] **Step 4: Full suite + build + commit**

Run: `pnpm test && pnpm build`
Expected: ALL green; build compiles.

```bash
git add tests/integration/e2e-distributors.test.ts docs/DEV.md
git commit -m "test: distributors & credits E2E + dev docs"
```

---

## Self-Review

**Spec coverage:**
- §2 distributors/credit_movements tables → Tasks 2,3 · §3 record_credit_movement fn+trigger+CHECK+status guard → Task 4 (CHECK from Task 2) · §4 domain (create shell/existing, update, setStatus matrix+activate+audit, setCreditLimit audited/bounded, credit record/list, stats) → Tasks 5,6,7,8,9 · §5 RBAC reuse + awaited gate → Task 10 · §6 UI list/detail/approval/credit design-first → Tasks 1,11,12,13 · §7 testing (RLS isolation auto via F0 rls-guard + per-table; integrity over-limit/negative/status/direct-insert; concurrency; status matrix; setCreditLimit audit+bound; stats; RBAC; E2E) → every task + Task 14 · §8 decisions honored · §9 build order. No gap.
- shop_user shell with sentinel `'!shell'` hash (§2) → Task 5 `SHELL_PASSWORD_HASH`. Limit-change via F0 audit (§2/§4) → Task 7. Approval queue (§6) → pending filter + StatusActions Approve/Reject (Tasks 11,13). Orders-credit primitive exposed (§1/§3) → `record_credit_movement` (Task 4) callable via `recordCreditMovement` (Task 8).

**Placeholder scan:** No TBD/TODO; every code step has full code; Task 1 is the explicit human-gated design step; no "similar to Task N". Tasks 12+13 explicitly noted as shipping together (12's page imports 13's components) with a single combined commit to avoid a broken intermediate build.

**Type consistency:** `withTenant(tenantId, fn)` used as in F0/Products throughout. `Distributor`/`CreateDistributorInput` (Task 5) consumed by setStatus/setCreditLimit (6,7), actions (10), pages (11,12). `CreditType`/`CreditMovement` defined in `credit.ts` (Task 8), imported by actions (10) and detail page (12). `record_credit_movement` SQL signature `(uuid,text,numeric,text,text)` consistent (Tasks 4,8). `setStatus(tenantId,id,next,actor)` / `setCreditLimit(tenantId,id,newLimit,actor)` signatures consistent across Tasks 6,7,10,14. Permission keys `distributors.read|write` match F0 `permissions.ts`. RLS policy + append-only SQL match F0/Products committed patterns. `writeAudit` signature `{tenantId,actor,action,target?,meta?}` matches F0 `src/lib/compliance/audit.ts`.

**Note for executor:** Task 7's test depends on Task 8's `recordCreditMovement`; author Task 7's test at Task 7 (TDD) but it goes green only after Task 8 — execute Task 8 immediately after Task 7's implementation and confirm both green before Task 7's commit (or commit Task 7 impl, then Task 8, then a fix-commit if needed). Tasks 12 & 13 ship in one commit (Task 13 Step 4). Task 1 (design) was pulled forward and APPROVED before backend resumed; the design-first gap-check surfaced the addendum below.

---

## Addendum — design-first amendments (approved)

The pulled-forward Task 1 design review (user-approved) added a tabbed distributor detail + an Activity tab. One small backend addition, no new tables.

### Task 9b: `activity.ts` — `listDistributorActivity` (insert after Task 9)

**Files:** Create `src/lib/distributors/activity.ts`, `tests/integration/distributor-activity.test.ts`

- [ ] **Step 1: Failing test** `tests/integration/distributor-activity.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createDistributor, setStatus, setCreditLimit } from '@/lib/distributors/distributors';
import { listDistributorActivity } from '@/lib/distributors/activity';

async function tid(slug:string){ await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('A',$1) returning id`,[slug]);
  return t.id; }

describe('listDistributorActivity', () => {
  it('returns this distributor audit rows newest-first; tenant-isolated', async () => {
    const t = await tid('da-1');
    const id = await createDistributor(t,{ businessName:'A',email:'a@x.com',
      contactName:'A',creditLimit:1000 });
    await setStatus(t, id, 'active', 'u1');           // distributor.status_changed
    await setCreditLimit(t, id, 2000, 'u1');          // distributor.credit_limit_changed
    const rows = await listDistributorActivity(t, id);
    expect(rows.map(r=>r.action)).toEqual(
      ['distributor.credit_limit_changed','distributor.status_changed']); // newest first
    expect(rows[0].meta.new).toBe(2000); expect(rows[0].actor).toBe('u1');
    const other = await tid('da-2');
    expect(await listDistributorActivity(other, id)).toEqual([]); // RLS-isolated
  });
});
```

- [ ] **Step 2:** `pnpm vitest run tests/integration/distributor-activity.test.ts` → FAIL (module missing).

- [ ] **Step 3:** Implement `src/lib/distributors/activity.ts`:
```ts
import { withTenant } from '@/lib/db/withTenant';

export type ActivityEntry = { action:string; actor:string;
  meta:Record<string,unknown>; created_at:string };

export async function listDistributorActivity(tenantId: string,
  distributorId: string): Promise<ActivityEntry[]> {
  return withTenant(tenantId, async c => (await c.query(
    `select action, actor, meta, created_at from audit_log
     where target=$1 and action like 'distributor.%'
     order by created_at desc`, [distributorId])).rows);
}
```
(`audit_log` is the F0 append-only table — already RLS-scoped by `tenant_id=current_tenant_id()`; `withTenant` scopes it, so a second tenant sees none. No new table/migration.)

- [ ] **Step 4:** `pnpm vitest run tests/integration/distributor-activity.test.ts` → PASS. Full `pnpm test` green.

- [ ] **Step 5:** Commit:
```bash
git add src/lib/distributors/activity.ts tests/integration/distributor-activity.test.ts
git commit -m "feat: listDistributorActivity (per-distributor F0 audit_log view)"
```

### Task 12 amendment — detail becomes a tabbed profile

`src/app/(tenant)/app/distributors/[id]/page.tsx` is built to the APPROVED `design/distributors/Tradon Distributors — UI.html` screen 02 (tabbed). Tabs rendered via a `?tab=` searchParam (server component, no client JS needed) or simple in-page sections styled as tabs — implementer's choice, but match the design:
- **Overview** (default): credit summary cards (limit/outstanding/available) + a details grid (business name, contact via shop_users, region, address, status, onboarded) + the existing `<StatusActions>`.
- **Credit**: `<CreditPanel>` (set-limit + record) + the `listCreditMovements` ledger **with an Actor column** (the `actor` field is already returned by `listCreditMovements`).
- **Activity**: `listDistributorActivity(tenant.id, id)` rendered as action / change(meta old→new) / actor · when; include the "actor shown as user-id; friendly-name later" hint.
- **Orders**: a deferred placeholder block ("arrives with the Orders sub-project") — NO Orders backend here.
Detail page also surfaces contact email/name from `shop_users` (join `shop_users` on `distributors.shop_user_id` in `getDistributor`, or a small `getDistributorContact` read — implementer's choice, tenant-scoped via withTenant). Semantic Tailwind only; server component; same auth/redirect order. Tasks 12+13 still ship together.

This addendum overrides the original Task 9 ordering note: execute Task 9b immediately after Task 9; Task 12 follows the amended spec above.
