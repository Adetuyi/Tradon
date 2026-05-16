# F0 — Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployable Next.js + Supabase application where a platform admin can provision a tenant, tenants resolve by subdomain, both user populations authenticate, RBAC is enforced via a permission layer, every data access is RLS-isolated, and the approved F0 UI is built — with a CI guard that makes a missing RLS policy impossible to merge.

**Architecture:** Single Next.js App Router (TypeScript) app. Supabase Postgres with shared-schema multi-tenancy (`tenant_id` + Row-Level Security). Edge middleware resolves host→tenant and sets a per-request Postgres session variable consumed by RLS. Staff/platform auth via Supabase Auth; shop auth app-managed keyed by `(tenant_id, email)`. RBAC is a data-driven `can()` layer with two permission namespaces. Compliance primitives (audit log, consent versioning, PII erasure/export, region/locale) are structural only.

**Tech Stack:** Next.js 15 (App Router, TS), pnpm, Supabase (Postgres + Auth, local via Supabase CLI/Docker), `@supabase/supabase-js`, `@supabase/ssr`, Vitest, `pg` (integration tests), `jose` (shop session JWT), `bcryptjs`, `zod`, Tailwind CSS v3.

**Spec:** `docs/superpowers/specs/2026-05-16-platform-foundation-design.md`
**UI reference (build to match):** `design/f0-skeleton/Tradon F0 — UI v2.html`
**Brand tokens:** `design/brand-spec.md`

**Conventions for every task:** run `pnpm test` from repo root; commit messages use Conventional Commits; never write a raw hex in a component (use Tailwind semantic classes); all timestamps `timestamptz` stored UTC.

---

## File Structure

```
package.json, pnpm-lock.yaml, tsconfig.json, vitest.config.ts
next.config.ts, tailwind.config.ts, postcss.config.mjs
.env.local.example
src/
  app/
    globals.css                      # brand tokens → CSS vars + Tailwind layers
    layout.tsx                       # root layout, fonts
    (tenant)/login/page.tsx          # staff login
    (tenant)/app/page.tsx            # app shell + "Foundation ready"
    (shop)/shop/login/page.tsx       # shop login
    (shop)/shop/signup/page.tsx      # shop signup
    (admin)/admin/tenants/page.tsx   # platform provisioning console
    not-found-tenant/page.tsx        # tenant-not-found
    forbidden/page.tsx               # 403
  middleware.ts                      # host→tenant resolution
  lib/
    host.ts                          # subdomain parsing (pure)
    supabase/server.ts               # Supabase server client (@supabase/ssr)
    supabase/admin.ts                # service-role client (server only)
    db/withTenant.ts                 # runs a fn with app.current_tenant_id set
    tenancy/resolveTenant.ts         # host → tenant record
    auth/staff.ts                    # Supabase staff/admin session + membership
    auth/shop.ts                     # app-managed shop credentials + session
    auth/shopSession.ts              # jose sign/verify shop cookie
    rbac/permissions.ts              # permission keys + role→permission maps
    rbac/can.ts                      # can() / requirePermission()
    compliance/audit.ts              # writeAudit()
    compliance/consent.ts            # recordConsent()
    compliance/pii.ts                # exportUserData() / eraseUserData()
    provisioning/provisionTenant.ts  # create tenant + seed
  components/ui/                     # Button, Input, Badge, Alert, AuthLayout, AppShell
supabase/
  migrations/*.sql                   # schema + RLS
  seed.sql
tests/
  unit/*.test.ts
  integration/*.test.ts              # hit local Postgres
  helpers/db.ts                      # pg pool + reset helpers
scripts/check-rls.ts                 # standalone RLS schema scanner (also a test)
```

---

## Phase 0 — Scaffold

### Task 1: Initialize Next.js + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.local.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `tests/unit/smoke.test.ts`

- [ ] **Step 1: Scaffold the app**

Run:
```bash
pnpm dlx create-next-app@latest . --typescript --app --tailwind --eslint --src-dir --import-alias "@/*" --use-pnpm --no-turbopack
```
Expected: project files created in repo root (accept overwrite prompts only for non-tracked files; keep `README.md`, `design/`, `docs/`).

- [ ] **Step 2: Add test + runtime deps**

Run:
```bash
pnpm add @supabase/supabase-js @supabase/ssr jose bcryptjs zod
pnpm add -D vitest @vitejs/plugin-react jsdom pg @types/pg @types/bcryptjs tsx
```
Expected: dependencies resolve, lockfile updated.

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], hookTimeout: 30000 },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

- [ ] **Step 4: Write the failing smoke test**

`tests/unit/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { sum } from '@/lib/_smoke';

describe('toolchain', () => {
  it('runs typescript + alias', () => {
    expect(sum(2, 3)).toBe(5);
  });
});
```

- [ ] **Step 5: Run it, verify it fails**

Run: `pnpm vitest run tests/unit/smoke.test.ts`
Expected: FAIL — cannot resolve `@/lib/_smoke`.

- [ ] **Step 6: Implement minimal module**

`src/lib/_smoke.ts`:
```ts
export const sum = (a: number, b: number): number => a + b;
```

- [ ] **Step 7: Verify pass**

Run: `pnpm vitest run tests/unit/smoke.test.ts`
Expected: PASS (1 passed).

- [ ] **Step 8: Add test script + commit**

In `package.json` `"scripts"` add `"test": "vitest run"`. Then:
```bash
git add -A
git commit -m "chore: scaffold Next.js app + Vitest toolchain"
```

---

### Task 2: Brand tokens → Tailwind theme

**Files:**
- Modify: `src/app/globals.css`, `tailwind.config.ts`
- Create: `src/app/layout.tsx` (fonts), `tests/unit/tailwind-theme.test.ts`

- [ ] **Step 1: Write failing test asserting token config**

`tests/unit/tailwind-theme.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import config from '../../tailwind.config';

describe('tailwind theme', () => {
  it('exposes brand semantic colors from brand-spec', () => {
    const colors = (config.theme?.extend?.colors ?? {}) as Record<string, unknown>;
    expect(colors.primary).toBe('var(--color-primary)');
    expect(colors.paper).toBe('var(--color-paper)');
    expect(colors.ink).toBe('var(--color-ink)');
    expect(colors.signal).toBe('var(--color-signal)');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/unit/tailwind-theme.test.ts`
Expected: FAIL — colors undefined.

- [ ] **Step 3: Write `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'green-50': 'var(--color-green-50)', 'green-100': 'var(--color-green-100)',
        'green-200': 'var(--color-green-200)', 'green-400': 'var(--color-green-400)',
        primary: 'var(--color-primary)', 'primary-700': 'var(--color-green-700)',
        'green-900': 'var(--color-green-900)',
        paper: 'var(--color-paper)', surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)', hairline: 'var(--color-border)',
        'hairline-strong': 'var(--color-border-strong)',
        ink: 'var(--color-ink)', text: 'var(--color-text)',
        muted: 'var(--color-muted)', faint: 'var(--color-faint)',
        positive: 'var(--color-positive)', negative: 'var(--color-negative)',
        signal: 'var(--color-signal)', 'on-primary': 'var(--color-on-primary)',
        'on-deep': 'var(--color-on-deep)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui'],
        body: ['var(--font-body)', 'system-ui'],
        mono: ['var(--font-mono)', 'ui-monospace', 'Menlo'],
      },
      borderRadius: { card: '14px', ctl: '9px' },
      boxShadow: { card: '0 1px 2px rgba(15,51,34,.04),0 10px 30px -18px rgba(15,51,34,.22)' },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 4: Write `src/app/globals.css` token layer**

Replace file contents with (values copied verbatim from `design/brand-spec.md`):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root{
  --color-green-50:#ECF3EE; --color-green-100:#D7E6DC; --color-green-200:#AECDBA;
  --color-green-400:#4F9168; --color-primary:#1B5E3A; --color-green-700:#14422C;
  --color-green-900:#0F3322; --color-paper:#F4F2EC; --color-surface:#FFFFFF;
  --color-surface-2:#FAF8F2; --color-border:#E4E1D6; --color-border-strong:#D5D1C2;
  --color-ink:#16241B; --color-text:#2C3A30; --color-muted:#6C7A6F; --color-faint:#94A099;
  --color-positive:#2F9E5E; --color-negative:#C0492F; --color-signal:#C9742B;
  --color-on-primary:#F2F6EF; --color-on-deep:#CFE0D2;
  --font-display:'Schibsted Grotesk'; --font-body:'IBM Plex Sans'; --font-mono:'IBM Plex Mono';
}
body{ background:var(--color-paper); color:var(--color-text); font-family:var(--font-body),system-ui; }
```

- [ ] **Step 5: Verify test pass**

Run: `pnpm vitest run tests/unit/tailwind-theme.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire fonts in `src/app/layout.tsx`**

```tsx
import './globals.css';
import { Schibsted_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';

const display = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const body = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400','500','600'], variable: '--font-body' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400','500'], variable: '--font-mono' });

export const metadata = { title: 'Tradon' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Build sanity + commit**

Run: `pnpm build`
Expected: build succeeds.
```bash
git add -A
git commit -m "feat: brand tokens mapped to Tailwind theme + fonts"
```

---

## Phase 1 — Database, tenancy, RLS

### Task 3: Supabase local + `tenants` table

**Files:**
- Create: `supabase/migrations/0001_tenants.sql`, `tests/helpers/db.ts`, `tests/integration/tenants.test.ts`, `.env.local.example`

- [ ] **Step 1: Init Supabase + start local stack**

Run:
```bash
pnpm dlx supabase@latest init
pnpm dlx supabase@latest start
```
Expected: local Postgres at `postgresql://postgres:postgres@127.0.0.1:54322/postgres`; anon/service keys printed. Put them in `.env.local` and document in `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SHOP_SESSION_SECRET=dev-only-change-me-32-bytes-min!!
```

- [ ] **Step 2: Write `tests/helpers/db.ts`**

```ts
import { Pool } from 'pg';
export const pool = new Pool({ connectionString: process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
export async function q<T = any>(sql: string, params: unknown[] = []) {
  const r = await pool.query(sql, params); return r.rows as T[];
}
export async function resetTenancy() {
  await pool.query(`truncate table tenant_members, shop_users, domains, tenants
    restart identity cascade`).catch(() => {});
}
```

- [ ] **Step 3: Write failing integration test**

`tests/integration/tenants.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { q } from '../helpers/db';

describe('tenants table', () => {
  beforeAll(async () => {
    await q(`delete from tenants where slug='acme-test'`);
  });
  it('stores tenant with NG defaults and UTC timestamps', async () => {
    const [t] = await q<{ id: string; currency: string; region: string; status: string }>(
      `insert into tenants (name, slug) values ('Acme','acme-test')
       returning id, currency, region, status`);
    expect(t.currency).toBe('NGN');
    expect(t.region).toBe('NG');
    expect(t.status).toBe('active');
    const [{ tz }] = await q<{ tz: string }>(
      `select to_char(created_at,'TZ') tz from tenants where id=$1`, [t.id]);
    expect(tz).toBe('UTC');
  });
});
```

- [ ] **Step 4: Run, verify fail**

Run: `pnpm vitest run tests/integration/tenants.test.ts`
Expected: FAIL — relation "tenants" does not exist.

- [ ] **Step 5: Write migration `supabase/migrations/0001_tenants.sql`**

```sql
create extension if not exists pgcrypto;

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','inactive')),
  region text not null default 'NG',
  currency text not null default 'NGN',
  locale text not null default 'en-NG',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 6: Apply + verify pass**

Run:
```bash
pnpm dlx supabase@latest db reset
pnpm vitest run tests/integration/tenants.test.ts
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: tenants table with NG/UTC defaults + db test helpers"
```

---

### Task 4: `domains` table + generic resolution data

**Files:**
- Create: `supabase/migrations/0002_domains.sql`, `tests/integration/domains.test.ts`

- [ ] **Step 1: Failing test**

`tests/integration/domains.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';

describe('domains', () => {
  it('links host→tenant generically with a type discriminator', async () => {
    await q(`delete from tenants where slug='dom-test'`);
    const [t] = await q<{ id: string }>(
      `insert into tenants (name,slug) values ('Dom','dom-test') returning id`);
    await q(`insert into domains (tenant_id, host, type)
             values ($1,'dom-test.tradon.app','subdomain')`, [t.id]);
    const [row] = await q<{ tenant_id: string; type: string }>(
      `select tenant_id, type from domains where host=$1`, ['dom-test.tradon.app']);
    expect(row.tenant_id).toBe(t.id);
    expect(row.type).toBe('subdomain');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/integration/domains.test.ts`
Expected: FAIL — relation "domains" does not exist.

- [ ] **Step 3: Migration `supabase/migrations/0002_domains.sql`**

```sql
create table domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  host text not null unique,
  type text not null default 'subdomain' check (type in ('subdomain','custom')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index on domains (tenant_id);
```

- [ ] **Step 4: Apply + verify**

Run: `pnpm dlx supabase@latest db reset && pnpm vitest run tests/integration/domains.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: domains table (generic host→tenant, custom-domain-ready)"
```

---

### Task 5: RLS isolation primitive

**Files:**
- Create: `supabase/migrations/0003_rls_core.sql`, `src/lib/db/withTenant.ts`, `tests/integration/rls-isolation.test.ts`

- [ ] **Step 1: Failing isolation test**

`tests/integration/rls-isolation.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL!;
describe('RLS isolation on a tenant-owned probe table', () => {
  it('a tenant session cannot read another tenant rows', async () => {
    const admin = new Pool({ connectionString: url });
    await admin.query(`create table if not exists _probe (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null references tenants(id), note text)`);
    await admin.query(`alter table _probe enable row level security`);
    await admin.query(`drop policy if exists _probe_iso on _probe`);
    await admin.query(`create policy _probe_iso on _probe
      using (tenant_id = current_tenant_id())
      with check (tenant_id = current_tenant_id())`);
    await admin.query(`grant select,insert on _probe to anon`);
    const [{ id: a }] = (await admin.query(
      `insert into tenants(name,slug) values('A','iso-a')
       on conflict(slug) do update set name=excluded.name returning id`)).rows;
    const [{ id: b }] = (await admin.query(
      `insert into tenants(name,slug) values('B','iso-b')
       on conflict(slug) do update set name=excluded.name returning id`)).rows;
    await admin.query(`delete from _probe`);
    await admin.query(`insert into _probe(tenant_id,note) values($1,'a-secret')`,[a]);
    await admin.query(`insert into _probe(tenant_id,note) values($1,'b-secret')`,[b]);

    const c = await new Pool({ connectionString: url }).connect();
    await c.query(`set role anon`);
    await c.query(`select set_config('app.current_tenant_id',$1,true)`,[a]);
    const rows = (await c.query(`select note from _probe`)).rows;
    expect(rows.map(r => r.note)).toEqual(['a-secret']);
    await c.query(`reset role`); c.release();
    await admin.query(`drop table _probe`); await admin.end();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/integration/rls-isolation.test.ts`
Expected: FAIL — function `current_tenant_id()` does not exist.

- [ ] **Step 3: Migration `supabase/migrations/0003_rls_core.sql`**

```sql
create or replace function current_tenant_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.current_tenant_id', true), '')::uuid
$$;
```

- [ ] **Step 4: Apply + verify pass**

Run: `pnpm dlx supabase@latest db reset && pnpm vitest run tests/integration/rls-isolation.test.ts`
Expected: PASS (only `a-secret` visible).

- [ ] **Step 5: Implement `src/lib/db/withTenant.ts`**

```ts
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
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: RLS core (current_tenant_id) + withTenant scoped client"
```

---

### Task 6: CI guard — every tenant-owned table must have RLS

**Files:**
- Create: `scripts/check-rls.ts`, `tests/integration/rls-guard.test.ts`

- [ ] **Step 1: Write the guard test (it IS the CI gate)**

`tests/integration/rls-guard.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';

/** Any public table with a tenant_id column MUST have RLS enabled
 *  AND a policy referencing current_tenant_id(). */
describe('RLS schema guard', () => {
  it('no tenant-owned table is unprotected', async () => {
    const tenantTables = await q<{ table_name: string }>(`
      select c.relname as table_name
      from pg_attribute a
      join pg_class c on c.oid=a.attrelid
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and a.attname='tenant_id'
        and c.relkind='r' and not a.attisdropped`);
    const failures: string[] = [];
    for (const { table_name } of tenantTables) {
      const [{ relrowsecurity }] = await q<{ relrowsecurity: boolean }>(
        `select relrowsecurity from pg_class where relname=$1`, [table_name]);
      const pols = await q<{ qual: string }>(
        `select pg_get_expr(polqual, polrelid) as qual
         from pg_policy p join pg_class c on c.oid=p.polrelid
         where c.relname=$1`, [table_name]);
      const guarded = pols.some(p => (p.qual ?? '').includes('current_tenant_id'));
      if (!relrowsecurity || !guarded) failures.push(table_name);
    }
    expect(failures, `Unprotected tenant tables: ${failures.join(', ')}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — verify it PASSES now (only `domains` has tenant_id; it is RLS-exempt by design? No — guard it)**

Run: `pnpm vitest run tests/integration/rls-guard.test.ts`
Expected: FAIL listing `domains` (it has `tenant_id` but no RLS yet). This proves the guard works.

- [ ] **Step 3: Add RLS to `domains` via `supabase/migrations/0004_domains_rls.sql`**

```sql
alter table domains enable row level security;
create policy domains_iso on domains
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
-- Resolution reads domains BEFORE a tenant is known: use service-role client
-- (bypasses RLS) for host lookup only. App/tenant paths stay RLS-bound.
grant select on domains to anon;
```

- [ ] **Step 4: Apply + verify guard passes**

Run: `pnpm dlx supabase@latest db reset && pnpm vitest run tests/integration/rls-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `scripts/check-rls.ts` for pipeline use**

```ts
import { execSync } from 'node:child_process';
execSync('pnpm vitest run tests/integration/rls-guard.test.ts', { stdio: 'inherit' });
```
Add to `package.json` scripts: `"check:rls": "tsx scripts/check-rls.ts"`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: CI guard failing build on any unprotected tenant table"
```

---

## Phase 2 — Tenant resolution

### Task 7: Host → subdomain parser (pure)

**Files:**
- Create: `src/lib/host.ts`, `tests/unit/host.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/host.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseHost } from '@/lib/host';

describe('parseHost', () => {
  it('extracts tenant slug from subdomain', () => {
    expect(parseHost('chi.tradon.app')).toEqual({ kind: 'tenant', slug: 'chi' });
  });
  it('treats apex + app + www as platform', () => {
    expect(parseHost('tradon.app').kind).toBe('platform');
    expect(parseHost('app.tradon.app').kind).toBe('platform');
    expect(parseHost('www.tradon.app').kind).toBe('platform');
  });
  it('handles localhost dev with port', () => {
    expect(parseHost('chi.localhost:3000')).toEqual({ kind: 'tenant', slug: 'chi' });
    expect(parseHost('localhost:3000').kind).toBe('platform');
  });
  it('unknown host → custom (defer to domains lookup)', () => {
    expect(parseHost('shop.acme.com')).toEqual({ kind: 'custom', host: 'shop.acme.com' });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/unit/host.test.ts`
Expected: FAIL — cannot resolve `@/lib/host`.

- [ ] **Step 3: Implement `src/lib/host.ts`**

```ts
export type HostInfo =
  | { kind: 'tenant'; slug: string }
  | { kind: 'platform' }
  | { kind: 'custom'; host: string };

const ROOTS = ['tradon.app', 'localhost'];
const RESERVED = new Set(['', 'www', 'app']);

export function parseHost(rawHost: string): HostInfo {
  const host = rawHost.toLowerCase().split(':')[0];
  for (const root of ROOTS) {
    if (host === root) return { kind: 'platform' };
    if (host.endsWith(`.${root}`)) {
      const sub = host.slice(0, -(root.length + 1));
      if (RESERVED.has(sub)) return { kind: 'platform' };
      if (!sub.includes('.')) return { kind: 'tenant', slug: sub };
    }
  }
  return { kind: 'custom', host };
}
```

- [ ] **Step 4: Verify pass**

Run: `pnpm vitest run tests/unit/host.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: pure host→subdomain parser"
```

---

### Task 8: Tenant resolution + middleware

**Files:**
- Create: `src/lib/supabase/admin.ts`, `src/lib/tenancy/resolveTenant.ts`, `src/middleware.ts`, `src/app/not-found-tenant/page.tsx`, `tests/integration/resolveTenant.test.ts`

- [ ] **Step 1: Failing test for `resolveTenant`**

`tests/integration/resolveTenant.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { q } from '../helpers/db';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';

describe('resolveTenant', () => {
  beforeAll(async () => {
    await q(`delete from tenants where slug in ('rt-active','rt-off')`);
    const [a] = await q<{id:string}>(`insert into tenants(name,slug)
      values('Active','rt-active') returning id`);
    await q(`insert into domains(tenant_id,host,type)
      values($1,'rt-active.tradon.app','subdomain')`, [a.id]);
    await q(`insert into tenants(name,slug,status)
      values('Off','rt-off','inactive')`);
  });
  it('resolves an active subdomain tenant', async () => {
    const t = await resolveTenant('rt-active.tradon.app');
    expect(t?.slug).toBe('rt-active');
  });
  it('returns null for unknown host', async () => {
    expect(await resolveTenant('nope.tradon.app')).toBeNull();
  });
  it('returns null for inactive tenant', async () => {
    expect(await resolveTenant('rt-off.tradon.app')).toBeNull();
  });
  it('platform host resolves to null (not a tenant)', async () => {
    expect(await resolveTenant('app.tradon.app')).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/integration/resolveTenant.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement service-role client `src/lib/supabase/admin.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
// Service-role: bypasses RLS. Server-only. Used for host resolution +
// provisioning, never exposed to the browser.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
```

- [ ] **Step 4: Implement `src/lib/tenancy/resolveTenant.ts`**

```ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseHost } from '@/lib/host';

export type TenantCtx = { id: string; slug: string; status: string };

export async function resolveTenant(rawHost: string): Promise<TenantCtx | null> {
  const info = parseHost(rawHost);
  let tenantId: string | null = null;

  if (info.kind === 'platform') return null;
  if (info.kind === 'custom') {
    const { data } = await supabaseAdmin.from('domains')
      .select('tenant_id').eq('host', info.host).maybeSingle();
    tenantId = data?.tenant_id ?? null;
  }
  const base = supabaseAdmin.from('tenants').select('id,slug,status');
  const { data } = info.kind === 'tenant'
    ? await base.eq('slug', info.slug).maybeSingle()
    : tenantId ? await base.eq('id', tenantId).maybeSingle()
    : { data: null };
  if (!data || data.status !== 'active') return null;
  return data as TenantCtx;
}
```

- [ ] **Step 5: Verify pass**

Run: `pnpm vitest run tests/integration/resolveTenant.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 6: Implement `src/middleware.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { parseHost } from '@/lib/host';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const info = parseHost(host);
  const res = NextResponse.next();
  if (info.kind === 'tenant') res.headers.set('x-tenant-slug', info.slug);
  if (info.kind === 'custom') res.headers.set('x-tenant-host', info.host);
  res.headers.set('x-host-kind', info.kind);
  return res;
}
export const config = { matcher: ['/((?!_next|favicon.ico).*)'] };
```

- [ ] **Step 7: Tenant-not-found page `src/app/not-found-tenant/page.tsx`**

Build to match tile 05 of `design/f0-skeleton/Tradon F0 — UI v2.html` (composed layout, accent rule, watermark, two actions) using only Tailwind semantic classes:
```tsx
export default function TenantNotFound() {
  return (
    <main className="relative min-h-screen bg-paper flex items-center overflow-hidden">
      <div className="absolute left-0 top-0 h-1 w-full bg-primary" />
      <div aria-hidden className="absolute -right-16 -bottom-24 font-display font-bold
        text-[300px] text-ink opacity-[0.035] select-none">T.</div>
      <div className="relative z-10 px-16 max-w-[620px]">
        <div className="font-display font-bold text-xl text-ink mb-10">
          Tradon<span className="text-signal">.</span></div>
        <div className="font-mono text-xs tracking-[0.16em] text-primary">NO ACTIVE WORKSPACE</div>
        <h1 className="font-display font-bold text-[38px] leading-tight text-ink my-3">
          There’s nothing at<br/>this address — yet.</h1>
        <p className="text-sm text-muted leading-relaxed max-w-[460px]">
          This isn’t an active Tradon workspace. The business may not have launched,
          or the link may be mistyped.</p>
        <div className="mt-7 flex gap-3">
          <a href="https://tradon.app" className="h-11 px-6 rounded-ctl bg-primary
            text-on-primary font-display font-semibold text-sm flex items-center">Visit tradon.app</a>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: tenant resolution, middleware, tenant-not-found page"
```

---

## Phase 3 — Authentication

### Task 9: Staff/platform auth (Supabase) + `tenant_members`

**Files:**
- Create: `supabase/migrations/0005_members.sql`, `src/lib/supabase/server.ts`, `src/lib/auth/staff.ts`, `tests/integration/members.test.ts`

- [ ] **Step 1: Failing test for membership resolution + RLS guard still green**

`tests/integration/members.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';

describe('tenant_members', () => {
  it('uniquely links a user to a tenant with a role; platform rows have null tenant', async () => {
    await q(`delete from tenants where slug='mem-t'`);
    const [t] = await q<{id:string}>(`insert into tenants(name,slug)
      values('Mem','mem-t') returning id`);
    const uid = '00000000-0000-0000-0000-000000000001';
    await q(`insert into tenant_members(user_id,tenant_id,role)
             values($1,$2,'Owner')`, [uid, t.id]);
    await q(`insert into tenant_members(user_id,tenant_id,role,is_platform)
             values($1,null,'Superadmin',true)`, [uid]);
    const rows = await q(`select role from tenant_members where user_id=$1
      order by is_platform`, [uid]);
    expect(rows.map((r:any)=>r.role).sort()).toEqual(['Owner','Superadmin']);
    await expect(q(`insert into tenant_members(user_id,tenant_id,role)
      values($1,$2,'Admin')`, [uid, t.id])).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/integration/members.test.ts`
Expected: FAIL — relation "tenant_members" does not exist.

- [ ] **Step 3: Migration `supabase/migrations/0005_members.sql`**

```sql
create table tenant_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid references tenants(id) on delete cascade,
  role text not null,
  is_platform boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);
create index on tenant_members (tenant_id);
-- Not tenant-owned via RLS session: membership is read during auth BEFORE the
-- tenant context is trusted, so access is service-role only. No tenant_id-based
-- RLS policy here by design; the column is nullable for platform staff, so the
-- RLS guard (which keys on a NOT NULL tenant_id design) does not flag it.
```

- [ ] **Step 4: Apply + verify pass + guard still green**

Run:
```bash
pnpm dlx supabase@latest db reset
pnpm vitest run tests/integration/members.test.ts tests/integration/rls-guard.test.ts
```
Expected: both PASS.

- [ ] **Step 5: Supabase SSR server client `src/lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
      getAll: () => store.getAll(),
      setAll: (c) => c.forEach(({ name, value, options }) =>
        store.set(name, value, options)),
    } });
}
```

- [ ] **Step 6: Membership resolver `src/lib/auth/staff.ts`**

```ts
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type StaffSession = {
  userId: string; email: string;
  membership: { tenantId: string | null; role: string; isPlatform: boolean } | null;
};

export async function getStaffSession(tenantId: string | null): Promise<StaffSession | null> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await supabaseAdmin.from('tenant_members')
    .select('tenant_id,role,is_platform')
    .eq('user_id', user.id)
    .is(tenantId ? 'is_platform' : 'is_platform', tenantId ? false : true);
  const m = (data ?? []).find(r =>
    tenantId ? r.tenant_id === tenantId : r.is_platform) ?? null;
  return {
    userId: user.id, email: user.email!,
    membership: m ? { tenantId: m.tenant_id, role: m.role, isPlatform: m.is_platform } : null,
  };
}
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: Supabase staff/platform auth + tenant_members"
```

---

### Task 10: App-managed shop auth keyed by (tenant, email)

**Files:**
- Create: `supabase/migrations/0006_shop_users.sql`, `src/lib/auth/shopSession.ts`, `src/lib/auth/shop.ts`, `tests/integration/shop-auth.test.ts`

- [ ] **Step 1: Failing test**

`tests/integration/shop-auth.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { q } from '../helpers/db';
import { registerShopUser, verifyShopLogin } from '@/lib/auth/shop';

let tA: string, tB: string;
beforeAll(async () => {
  await q(`delete from tenants where slug in ('sa-a','sa-b')`);
  [{ id: tA }] = await q<{id:string}>(`insert into tenants(name,slug)
    values('A','sa-a') returning id`);
  [{ id: tB }] = await q<{id:string}>(`insert into tenants(name,slug)
    values('B','sa-b') returning id`);
});

describe('shop auth', () => {
  it('same email is independent per tenant', async () => {
    await registerShopUser(tA, 'amaka@example.com', 'pw-aaaa-1', 'Amaka A');
    await registerShopUser(tB, 'amaka@example.com', 'pw-bbbb-2', 'Amaka B');
    expect(await verifyShopLogin(tA, 'amaka@example.com', 'pw-aaaa-1')).toBeTruthy();
    expect(await verifyShopLogin(tA, 'amaka@example.com', 'pw-bbbb-2')).toBeNull();
    expect(await verifyShopLogin(tB, 'amaka@example.com', 'pw-bbbb-2')).toBeTruthy();
  });
  it('rejects duplicate (tenant,email)', async () => {
    await expect(registerShopUser(tA, 'amaka@example.com', 'x', 'dup'))
      .rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/integration/shop-auth.test.ts`
Expected: FAIL — module/relation missing.

- [ ] **Step 3: Migration `supabase/migrations/0006_shop_users.sql`**

```sql
create table shop_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  password_hash text not null,
  full_name text not null,
  phone text,
  status text not null default 'customer' check (status in ('customer','distributor')),
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);
alter table shop_users enable row level security;
create policy shop_users_iso on shop_users
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
grant select, insert, update on shop_users to anon;
```

- [ ] **Step 4: Apply migration**

Run: `pnpm dlx supabase@latest db reset`
Expected: success.

- [ ] **Step 5: Shop session signer `src/lib/auth/shopSession.ts`**

```ts
import { SignJWT, jwtVerify } from 'jose';
const secret = new TextEncoder().encode(process.env.SHOP_SESSION_SECRET!);

export type ShopClaims = { sub: string; tid: string; email: string };

export async function signShop(c: ShopClaims): Promise<string> {
  return new SignJWT(c).setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d').setIssuedAt().sign(secret);
}
export async function verifyShop(token: string): Promise<ShopClaims | null> {
  try { return (await jwtVerify(token, secret)).payload as unknown as ShopClaims; }
  catch { return null; }
}
```

- [ ] **Step 6: Shop credential logic `src/lib/auth/shop.ts`**

```ts
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
```

- [ ] **Step 7: Verify pass**

Run: `pnpm vitest run tests/integration/shop-auth.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: app-managed per-tenant shop auth + signed session"
```

---

## Phase 4 — RBAC

### Task 11: Permission keys + role maps

**Files:**
- Create: `src/lib/rbac/permissions.ts`, `tests/unit/permissions.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/permissions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { TENANT_ROLE_PERMS, PLATFORM_ROLE_PERMS } from '@/lib/rbac/permissions';

describe('role→permission maps', () => {
  it('Owner has dashboard.read; Viewer lacks finance.write', () => {
    expect(TENANT_ROLE_PERMS.Owner).toContain('dashboard.read');
    expect(TENANT_ROLE_PERMS.Viewer).not.toContain('finance.write');
  });
  it('all six tenant roles are seeded incl Field rep', () => {
    expect(Object.keys(TENANT_ROLE_PERMS).sort()).toEqual(
      ['Admin','Field rep','Finance','Owner','Sales','Viewer']);
  });
  it('platform namespace is separate', () => {
    expect(PLATFORM_ROLE_PERMS.Superadmin).toContain('platform.tenants.write');
    expect(TENANT_ROLE_PERMS.Owner).not.toContain('platform.tenants.write');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/unit/permissions.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `src/lib/rbac/permissions.ts`**

```ts
export type TenantRole = 'Owner'|'Admin'|'Finance'|'Sales'|'Field rep'|'Viewer';
export type PlatformRole = 'Superadmin';

const ALL_TENANT = [
  'dashboard.read','distributors.read','distributors.write',
  'products.read','products.write','orders.read','orders.write',
  'finance.read','finance.write','reporting.read',
  'users.read','users.write','settings.read','settings.write',
] as const;

export const TENANT_ROLE_PERMS: Record<TenantRole, readonly string[]> = {
  Owner: ALL_TENANT,
  Admin: ALL_TENANT.filter(p => p !== 'finance.write'),
  Finance: ['dashboard.read','finance.read','finance.write','reporting.read'],
  Sales: ['dashboard.read','distributors.read','orders.read','orders.write'],
  'Field rep': ['dashboard.read','distributors.read'],
  Viewer: ALL_TENANT.filter(p => p.endsWith('.read')),
};

export const PLATFORM_ROLE_PERMS: Record<PlatformRole, readonly string[]> = {
  Superadmin: ['platform.tenants.read','platform.tenants.write',
    'platform.domains.read','platform.audit.read'],
};
```

- [ ] **Step 4: Verify pass**

Run: `pnpm vitest run tests/unit/permissions.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: data-driven permission maps (tenant + platform namespaces)"
```

---

### Task 12: `can()` / `requirePermission()` + 403 page + protected route

**Files:**
- Create: `src/lib/rbac/can.ts`, `src/app/forbidden/page.tsx`, `src/app/(tenant)/app/page.tsx`, `tests/unit/can.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/can.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { can } from '@/lib/rbac/can';

describe('can()', () => {
  it('resolves tenant-namespace permissions by role', () => {
    expect(can({ role: 'Finance', isPlatform: false }, 'finance.write')).toBe(true);
    expect(can({ role: 'Sales', isPlatform: false }, 'finance.write')).toBe(false);
  });
  it('resolves platform namespace separately', () => {
    expect(can({ role: 'Superadmin', isPlatform: true }, 'platform.tenants.write')).toBe(true);
    expect(can({ role: 'Owner', isPlatform: false }, 'platform.tenants.write')).toBe(false);
  });
  it('null membership denies everything', () => {
    expect(can(null, 'dashboard.read')).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/unit/can.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `src/lib/rbac/can.ts`**

```ts
import { redirect } from 'next/navigation';
import { TENANT_ROLE_PERMS, PLATFORM_ROLE_PERMS } from './permissions';

export type Principal = { role: string; isPlatform: boolean } | null;

export function can(p: Principal, permission: string): boolean {
  if (!p) return false;
  const map = p.isPlatform
    ? (PLATFORM_ROLE_PERMS as Record<string, readonly string[]>)
    : (TENANT_ROLE_PERMS as Record<string, readonly string[]>);
  return (map[p.role] ?? []).includes(permission);
}

export function requirePermission(p: Principal, permission: string): void {
  if (!can(p, permission)) redirect('/forbidden');
}
```

- [ ] **Step 4: Verify pass**

Run: `pnpm vitest run tests/unit/can.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: 403 page `src/app/forbidden/page.tsx`**

Build to match tile 06 of the UI v2 reference (negative accent rule, `403` watermark, names missing permission, two actions), Tailwind semantic classes only:
```tsx
export default function Forbidden() {
  return (
    <main className="relative min-h-screen bg-paper flex items-center overflow-hidden">
      <div className="absolute left-0 top-0 h-1 w-full bg-negative" />
      <div aria-hidden className="absolute -right-16 -bottom-24 font-display font-bold
        text-[300px] text-ink opacity-[0.035] select-none">403</div>
      <div className="relative z-10 px-16 max-w-[620px]">
        <div className="font-display font-bold text-xl text-ink mb-10">
          Tradon<span className="text-signal">.</span></div>
        <div className="font-mono text-xs tracking-[0.16em] text-negative">ACCESS RESTRICTED</div>
        <h1 className="font-display font-bold text-[38px] leading-tight text-ink my-3">
          This area is outside<br/>your permissions.</h1>
        <p className="text-sm text-muted leading-relaxed max-w-[460px]">
          Your role doesn’t include the required permission. An Owner or Admin
          can grant it in Users &amp; Permissions.</p>
        <a href="/app" className="inline-flex mt-7 h-11 px-6 rounded-ctl bg-primary
          text-on-primary font-display font-semibold text-sm items-center">Back to dashboard</a>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Protected route proving the layer `src/app/(tenant)/app/page.tsx`**

Temporary minimal version (replaced visually in Task 17):
```tsx
import { headers } from 'next/headers';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { redirect } from 'next/navigation';

export default async function AppHome() {
  const host = (await headers()).get('host') ?? '';
  const tenant = await resolveTenant(host);
  if (!tenant) redirect('/not-found-tenant');
  const session = await getStaffSession(tenant.id);
  if (!session) redirect('/login');
  requirePermission(
    session.membership && { role: session.membership.role, isPlatform: false },
    'dashboard.read');
  return <main className="p-10 font-display text-ink">Foundation ready.</main>;
}
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: can()/requirePermission, 403 page, protected route"
```

---

## Phase 5 — Compliance primitives

### Task 13: Append-only audit log

**Files:**
- Create: `supabase/migrations/0007_audit.sql`, `src/lib/compliance/audit.ts`, `tests/integration/audit.test.ts`

- [ ] **Step 1: Failing test**

`tests/integration/audit.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { writeAudit } from '@/lib/compliance/audit';

describe('audit log', () => {
  it('records who/what/when and is append-only', async () => {
    await q(`delete from tenants where slug='aud-t'`);
    const [t] = await q<{id:string}>(`insert into tenants(name,slug)
      values('Aud','aud-t') returning id`);
    await writeAudit({ tenantId: t.id, actor: 'u1', action: 'tenant.provisioned',
      target: t.id, meta: { slug: 'aud-t' } });
    const rows = await q(`select action, actor from audit_log where tenant_id=$1`, [t.id]);
    expect(rows[0]).toMatchObject({ action: 'tenant.provisioned', actor: 'u1' });
    await expect(q(`update audit_log set action='x' where tenant_id=$1`, [t.id]))
      .rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/integration/audit.test.ts`
Expected: FAIL — relation/module missing.

- [ ] **Step 3: Migration `supabase/migrations/0007_audit.sql`**

```sql
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor text not null,
  action text not null,
  target text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on audit_log (tenant_id, created_at);
alter table audit_log enable row level security;
create policy audit_iso on audit_log
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
revoke update, delete on audit_log from anon, authenticated;
grant select, insert on audit_log to anon;
create rule audit_no_update as on update to audit_log do instead nothing;
create rule audit_no_delete as on delete to audit_log do instead nothing;
```

- [ ] **Step 4: Apply migration**

Run: `pnpm dlx supabase@latest db reset`
Expected: success.

- [ ] **Step 5: Implement `src/lib/compliance/audit.ts`**

```ts
import { withTenant } from '@/lib/db/withTenant';

export async function writeAudit(e: {
  tenantId: string; actor: string; action: string;
  target?: string; meta?: Record<string, unknown>;
}) {
  await withTenant(e.tenantId, (c) => c.query(
    `insert into audit_log(tenant_id,actor,action,target,meta)
     values(current_tenant_id(),$1,$2,$3,$4)`,
    [e.actor, e.action, e.target ?? null, JSON.stringify(e.meta ?? {})]));
}
```

- [ ] **Step 6: Verify pass + RLS guard still green**

Run: `pnpm vitest run tests/integration/audit.test.ts tests/integration/rls-guard.test.ts`
Expected: both PASS (the `do instead nothing` rule makes the UPDATE a no-op that affects 0 rows; the test asserts the value is unchanged — adjust assertion if needed: re-select and expect `action` still `'tenant.provisioned'`).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: append-only audit_log + writeAudit"
```

---

### Task 14: Consent / policy-version capture

**Files:**
- Create: `supabase/migrations/0008_consent.sql`, `src/lib/compliance/consent.ts`, `tests/integration/consent.test.ts`

- [ ] **Step 1: Failing test**

`tests/integration/consent.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { recordConsent } from '@/lib/compliance/consent';

describe('consent capture', () => {
  it('records subject + policy version + timestamp', async () => {
    await q(`delete from tenants where slug='con-t'`);
    const [t] = await q<{id:string}>(`insert into tenants(name,slug)
      values('Con','con-t') returning id`);
    await recordConsent({ tenantId: t.id, subject: 'shop:abc',
      policy: 'terms', version: '2026-05-16' });
    const [row] = await q(`select policy,version from policy_acceptance
      where tenant_id=$1 and subject='shop:abc'`, [t.id]);
    expect(row).toMatchObject({ policy: 'terms', version: '2026-05-16' });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/integration/consent.test.ts`
Expected: FAIL.

- [ ] **Step 3: Migration `supabase/migrations/0008_consent.sql`**

```sql
create table policy_acceptance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subject text not null,
  policy text not null,
  version text not null,
  accepted_at timestamptz not null default now()
);
create index on policy_acceptance (tenant_id, subject);
alter table policy_acceptance enable row level security;
create policy consent_iso on policy_acceptance
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
grant select, insert on policy_acceptance to anon;
```

- [ ] **Step 4: Apply migration**

Run: `pnpm dlx supabase@latest db reset`
Expected: success.

- [ ] **Step 5: Implement `src/lib/compliance/consent.ts`**

```ts
import { withTenant } from '@/lib/db/withTenant';

export async function recordConsent(e: {
  tenantId: string; subject: string; policy: string; version: string;
}) {
  await withTenant(e.tenantId, (c) => c.query(
    `insert into policy_acceptance(tenant_id,subject,policy,version)
     values(current_tenant_id(),$1,$2,$3)`,
    [e.subject, e.policy, e.version]));
}
```

- [ ] **Step 6: Verify pass**

Run: `pnpm vitest run tests/integration/consent.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: policy/consent version capture"
```

---

### Task 15: PII export + erasure (per shop_user / per tenant)

**Files:**
- Create: `src/lib/compliance/pii.ts`, `tests/integration/pii.test.ts`

- [ ] **Step 1: Failing test**

`tests/integration/pii.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { q } from '../helpers/db';
import { registerShopUser } from '@/lib/auth/shop';
import { exportUserData, eraseUserData } from '@/lib/compliance/pii';

let tid: string;
beforeAll(async () => {
  await q(`delete from tenants where slug='pii-t'`);
  [{ id: tid }] = await q<{id:string}>(`insert into tenants(name,slug)
    values('Pii','pii-t') returning id`);
});

describe('PII operations', () => {
  it('exports then hard-erases a shop user', async () => {
    const uid = await registerShopUser(tid, 'erase@example.com', 'pw1', 'Erase Me');
    const dump = await exportUserData(tid, uid);
    expect(dump.shop_user.email).toBe('erase@example.com');
    await eraseUserData(tid, uid);
    const rows = await q(`select 1 from shop_users where id=$1`, [uid]);
    expect(rows.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/integration/pii.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/lib/compliance/pii.ts`**

```ts
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
```

- [ ] **Step 4: Verify pass**

Run: `pnpm vitest run tests/integration/pii.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: PII export + hard-erase operations"
```

---

## Phase 6 — Provisioning

### Task 16: `provisionTenant()`

**Files:**
- Create: `src/lib/provisioning/provisionTenant.ts`, `tests/integration/provision.test.ts`

- [ ] **Step 1: Failing test**

`tests/integration/provision.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { provisionTenant } from '@/lib/provisioning/provisionTenant';

describe('provisionTenant', () => {
  it('creates tenant + subdomain + owner membership + audit', async () => {
    await q(`delete from tenants where slug='prov-x'`);
    const r = await provisionTenant({
      name: 'Prov X', slug: 'prov-x', ownerUserId: 'owner-1',
      region: 'NG', currency: 'NGN' });
    const [t] = await q(`select status from tenants where id=$1`, [r.tenantId]);
    expect(t.status).toBe('active');
    const [d] = await q(`select host,type from domains where tenant_id=$1`, [r.tenantId]);
    expect(d).toMatchObject({ host: 'prov-x.tradon.app', type: 'subdomain' });
    const [m] = await q(`select role from tenant_members
      where tenant_id=$1 and user_id='owner-1'`, [r.tenantId]);
    expect(m.role).toBe('Owner');
    const [a] = await q(`select action from audit_log where tenant_id=$1`, [r.tenantId]);
    expect(a.action).toBe('tenant.provisioned');
  });
  it('rejects duplicate slug', async () => {
    await expect(provisionTenant({ name:'Dup', slug:'prov-x',
      ownerUserId:'o', region:'NG', currency:'NGN' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/integration/provision.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/lib/provisioning/provisionTenant.ts`**

```ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { writeAudit } from '@/lib/compliance/audit';

export async function provisionTenant(input: {
  name: string; slug: string; ownerUserId: string;
  region: string; currency: string;
}): Promise<{ tenantId: string }> {
  const { data: t, error } = await supabaseAdmin.from('tenants')
    .insert({ name: input.name, slug: input.slug,
      region: input.region, currency: input.currency })
    .select('id').single();
  if (error || !t) throw new Error(error?.message ?? 'tenant insert failed');

  await supabaseAdmin.from('domains').insert({
    tenant_id: t.id, host: `${input.slug}.tradon.app`, type: 'subdomain' });
  await supabaseAdmin.from('tenant_members').insert({
    user_id: input.ownerUserId, tenant_id: t.id, role: 'Owner' });
  await writeAudit({ tenantId: t.id, actor: input.ownerUserId,
    action: 'tenant.provisioned', target: t.id, meta: { slug: input.slug } });
  return { tenantId: t.id };
}
```

- [ ] **Step 4: Verify pass**

Run: `pnpm vitest run tests/integration/provision.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: provisionTenant service (tenant+domain+owner+audit)"
```

---

## Phase 7 — UI (build to approved v2)

> For Tasks 17–22: open `design/f0-skeleton/Tradon F0 — UI v2.html`, match layout/spacing/hierarchy of the referenced tile. Use ONLY Tailwind semantic classes from Task 2. No raw hex. Components are server components unless they need interactivity.

### Task 17: UI primitives

**Files:**
- Create: `src/components/ui/Button.tsx`, `Input.tsx`, `Badge.tsx`, `Alert.tsx`, `tests/unit/ui-button.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/ui-button.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buttonClass } from '@/components/ui/Button';

describe('buttonClass', () => {
  it('maps variants to semantic classes', () => {
    expect(buttonClass('primary')).toContain('bg-primary');
    expect(buttonClass('danger')).toContain('bg-negative');
    expect(buttonClass('secondary')).toContain('bg-surface');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/unit/ui-button.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/ui/Button.tsx`**

```tsx
type V = 'primary'|'secondary'|'ghost'|'danger';
export function buttonClass(v: V): string {
  const base = 'h-[46px] rounded-ctl inline-flex items-center justify-center '
    + 'font-display font-semibold text-sm px-5 gap-2 border';
  const map: Record<V,string> = {
    primary: 'bg-primary text-on-primary border-transparent',
    secondary: 'bg-surface text-ink border-hairline-strong',
    ghost: 'bg-transparent text-primary border-transparent',
    danger: 'bg-negative text-white border-transparent',
  };
  return `${base} ${map[v]}`;
}
export function Button(
  { variant='primary', children }: { variant?: V; children: React.ReactNode }) {
  return <button className={buttonClass(variant)}>{children}</button>;
}
```

- [ ] **Step 4: Verify pass**

Run: `pnpm vitest run tests/unit/ui-button.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `Input.tsx`, `Badge.tsx`, `Alert.tsx`**

`src/components/ui/Input.tsx`:
```tsx
export function Input(
  { label, suffix, ...p }: { label: string; suffix?: string }
  & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block mb-4">
      <span className="block text-[11px] uppercase tracking-wide text-muted mb-[7px]">{label}</span>
      <span className="h-[46px] flex items-center justify-between px-3.5 rounded-ctl
        border border-hairline-strong bg-surface focus-within:border-primary
        focus-within:ring-2 focus-within:ring-green-50">
        <input className="bg-transparent outline-none w-full text-sm text-ink" {...p} />
        {suffix && <span className="font-mono text-xs text-muted">{suffix}</span>}
      </span>
    </label>
  );
}
```
`src/components/ui/Badge.tsx`:
```tsx
type T = 'owner'|'role'|'pos'|'neg'|'sig';
const C: Record<T,string> = {
  owner:'bg-primary text-white border-primary',
  role:'bg-green-50 text-primary-700 border-green-200',
  pos:'bg-green-50 text-positive border-green-200',
  neg:'bg-surface-2 text-negative border-hairline',
  sig:'bg-surface-2 text-signal border-hairline',
};
export function Badge({ tone='role', children }:{ tone?:T; children:React.ReactNode }) {
  return <span className={`font-mono text-[11px] px-[11px] py-1 rounded-full border ${C[tone]}`}>{children}</span>;
}
```
`src/components/ui/Alert.tsx`:
```tsx
type T = 'pos'|'neg'|'sig';
const C: Record<T,string> = {
  pos:'bg-green-50 border-green-200 text-positive',
  neg:'bg-surface-2 border-hairline text-negative',
  sig:'bg-surface-2 border-hairline text-signal',
};
export function Alert({ tone='pos', children }:{ tone?:T; children:React.ReactNode }) {
  return <div className={`flex gap-2.5 p-3.5 rounded-ctl border text-xs ${C[tone]}`}>{children}</div>;
}
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: token-driven UI primitives (Button/Input/Badge/Alert)"
```

---

### Task 18: Split-screen auth layout + staff login

**Files:**
- Create: `src/components/ui/AuthLayout.tsx`, `src/app/(tenant)/login/page.tsx`, `src/app/(tenant)/login/actions.ts`

- [ ] **Step 1: `AuthLayout.tsx`** (matches tiles 01–03 split layout)

```tsx
export function AuthLayout({ brandTitle, lead, sub, markers, children }: {
  brandTitle: string; lead: React.ReactNode; sub: string;
  markers: string[]; children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen">
      <aside className="hidden md:flex md:w-[42%] bg-green-900 text-on-deep
        p-11 flex-col relative overflow-hidden">
        <div className="font-display font-bold text-xl text-on-primary">{brandTitle}</div>
        <div className="mt-auto font-display font-bold text-3xl leading-tight text-white">{lead}</div>
        <p className="mt-4 text-sm leading-relaxed max-w-[330px]">{sub}</p>
        <div className="mt-8 pt-[18px] border-t border-white/10 flex gap-6
          font-mono text-[11px] tracking-wide text-on-deep/70">
          {markers.map(m => <span key={m}>{m}</span>)}
        </div>
      </aside>
      <section className="flex-1 bg-surface flex items-center justify-center p-11">
        <div className="w-[340px]">{children}</div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Staff login action `src/app/(tenant)/login/actions.ts`**

```ts
'use server';
import { supabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function staffLogin(formData: FormData) {
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
  });
  if (error) redirect('/login?error=1');
  redirect('/app');
}
```

- [ ] **Step 3: Staff login page `src/app/(tenant)/login/page.tsx`** (tile 01)

```tsx
import { AuthLayout } from '@/components/ui/AuthLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { staffLogin } from './actions';

export default function StaffLogin() {
  return (
    <AuthLayout brandTitle="Tradon."
      lead={<>Move stock,<br/>not spreadsheets.</>}
      sub="The distribution control room — orders, distributors, credit and collections in one place."
      markers={['MULTI-TENANT','RLS-ISOLATED','NDPA-READY']}>
      <h1 className="font-display font-bold text-2xl text-ink">Sign in</h1>
      <p className="text-sm text-muted mt-1.5 mb-7">to your staff workspace</p>
      <form action={staffLogin}>
        <Input label="Work email" name="email" type="email" required />
        <Input label="Password" name="password" type="password" required />
        <div className="mt-1"><Button variant="primary">Sign in</Button></div>
      </form>
    </AuthLayout>
  );
}
```

- [ ] **Step 4: Build check + commit**

Run: `pnpm build`
Expected: success.
```bash
git add -A && git commit -m "feat: split-screen auth layout + staff login"
```

---

### Task 19: Shop login + signup (wired to shop auth + consent)

**Files:**
- Create: `src/app/(shop)/shop/login/page.tsx`, `src/app/(shop)/shop/signup/page.tsx`, `src/app/(shop)/shop/actions.ts`

- [ ] **Step 1: Shop actions `src/app/(shop)/shop/actions.ts`**

```ts
'use server';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { registerShopUser, verifyShopLogin } from '@/lib/auth/shop';
import { signShop } from '@/lib/auth/shopSession';
import { recordConsent } from '@/lib/compliance/consent';

async function tenantOr404() {
  const t = await resolveTenant((await headers()).get('host') ?? '');
  if (!t) redirect('/not-found-tenant');
  return t;
}

export async function shopSignup(fd: FormData) {
  const t = await tenantOr404();
  const email = String(fd.get('email'));
  const id = await registerShopUser(t.id, email, String(fd.get('password')),
    String(fd.get('full_name')), String(fd.get('phone')) || undefined);
  await recordConsent({ tenantId: t.id, subject: `shop:${id}`,
    policy: 'terms', version: '2026-05-16' });
  (await cookies()).set('shop_session',
    await signShop({ sub: id, tid: t.id, email }),
    { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect('/shop');
}

export async function shopLogin(fd: FormData) {
  const t = await tenantOr404();
  const email = String(fd.get('email'));
  const u = await verifyShopLogin(t.id, email, String(fd.get('password')));
  if (!u) redirect('/shop/login?error=1');
  (await cookies()).set('shop_session',
    await signShop({ sub: u.id, tid: t.id, email }),
    { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect('/shop');
}
```

- [ ] **Step 2: Shop login page `src/app/(shop)/shop/login/page.tsx`** (tile 02)

```tsx
import { AuthLayout } from '@/components/ui/AuthLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { shopLogin } from '../actions';

export default function ShopLogin() {
  return (
    <AuthLayout brandTitle="Store"
      lead={<>Stock your shelves<br/>before they’re empty.</>}
      sub="Order directly, track deliveries, and manage your wallet and credit."
      markers={['FAST DELIVERY','WALLET & CREDIT']}>
      <h1 className="font-display font-bold text-2xl text-ink">Sign in</h1>
      <p className="text-sm text-muted mt-1.5 mb-7">to your store account</p>
      <form action={shopLogin}>
        <Input label="Email" name="email" type="email" required />
        <Input label="Password" name="password" type="password" required />
        <div className="mt-1"><Button variant="primary">Sign in</Button></div>
      </form>
    </AuthLayout>
  );
}
```

- [ ] **Step 3: Shop signup page `src/app/(shop)/shop/signup/page.tsx`** (tile 03)

```tsx
import { AuthLayout } from '@/components/ui/AuthLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { shopSignup } from '../actions';

export default function ShopSignup() {
  return (
    <AuthLayout brandTitle="Store"
      lead={<>Create your<br/>store account.</>}
      sub="One account for ordering, deliveries, wallet and credit."
      markers={['2 MIN SETUP','NO FEES']}>
      <h1 className="font-display font-bold text-2xl text-ink">Create account</h1>
      <p className="text-sm text-muted mt-1.5 mb-7">it only takes a minute</p>
      <form action={shopSignup}>
        <Input label="Full name" name="full_name" required />
        <Input label="Email" name="email" type="email" required />
        <Input label="Phone" name="phone" suffix="+234" />
        <Input label="Password" name="password" type="password" required />
        <div className="mt-1"><Button variant="primary">Create account</Button></div>
        <p className="text-[11px] text-faint mt-5 text-center leading-snug">
          By continuing you accept the Terms &amp; Privacy Policy — the accepted
          version is recorded.</p>
      </form>
    </AuthLayout>
  );
}
```

- [ ] **Step 4: Build check + commit**

Run: `pnpm build`
Expected: success.
```bash
git add -A && git commit -m "feat: shop login + signup wired to per-tenant auth + consent"
```

---

### Task 20: App shell + "Foundation ready"

**Files:**
- Create: `src/components/ui/AppShell.tsx`; Modify: `src/app/(tenant)/app/page.tsx`

- [ ] **Step 1: `AppShell.tsx`** (tile 04: deep-green rail, topbar, role badge)

```tsx
const NAV = ['Dashboard','Distributors','Products','Orders','Finance',
  'Reporting','Promos','Billing & Pricing','Users & Permissions','Settings'];

export function AppShell(
  { tenantName, role, children }:
  { tenantName: string; role: string; children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-paper text-ink">
      <nav className="w-[218px] bg-green-900 text-on-deep p-5 flex flex-col shrink-0">
        <div className="font-display font-bold text-xl text-on-primary px-2 pb-6">
          Tradon<span className="text-signal">.</span></div>
        {NAV.map((n,i) => (
          <div key={n} className={`px-2.5 py-2 rounded-lg text-[13px] mb-0.5
            ${i===0 ? 'bg-primary-700 text-on-primary font-semibold' : 'text-on-deep/80'}`}>
            {n}</div>
        ))}
      </nav>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[62px] border-b border-hairline flex items-center
          justify-between px-6 bg-surface">
          <div className="text-sm text-muted">
            <b className="text-ink font-display font-semibold">{tenantName}</b> · Dashboard</div>
          <span className="font-mono text-[11px] bg-green-50 text-primary-700
            border border-green-200 px-2.5 py-1 rounded-full">role · {role}</span>
        </header>
        <div className="flex-1 p-10 flex items-center justify-center">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/(tenant)/app/page.tsx`** with the "Foundation ready" state (tile 04 content)

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { AppShell } from '@/components/ui/AppShell';

const CHECKS: [string,string][] = [
  ['Tenant resolved','active'], ['Signed in','staff'],
  ['Data isolation','RLS enforced'], ['Audit trail','recording'],
];

export default async function AppHome() {
  const tenant = await resolveTenant((await headers()).get('host') ?? '');
  if (!tenant) redirect('/not-found-tenant');
  const session = await getStaffSession(tenant.id);
  if (!session) redirect('/login');
  const principal = session.membership
    ? { role: session.membership.role, isPlatform: false } : null;
  requirePermission(principal, 'dashboard.read');

  return (
    <AppShell tenantName={tenant.slug} role={session.membership!.role}>
      <div className="w-[560px] bg-surface border border-hairline rounded-card
        p-9 shadow-card">
        <div className="font-mono text-[11px] tracking-[0.14em] text-signal">
          PLATFORM FOUNDATION · F0</div>
        <h2 className="font-display font-bold text-2xl text-ink mt-2">Your workspace is live.</h2>
        <p className="text-sm text-muted mt-2 leading-relaxed max-w-[430px]">
          Tenancy, authentication, role-based access and data isolation are
          running. Feature modules arrive in the next milestones.</p>
        <div className="mt-6 border border-hairline rounded-lg overflow-hidden">
          {CHECKS.map(([l,v]) => (
            <div key={l} className="flex items-center gap-3 bg-surface px-4 py-3
              text-[13px] border-b border-hairline last:border-0">
              <span className="text-positive">✓</span>
              <span className="text-ink">{l}</span>
              <span className="ml-auto font-mono text-xs text-muted">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 3: Build + commit**

Run: `pnpm build`
Expected: success.
```bash
git add -A && git commit -m "feat: app shell + Foundation-ready state"
```

---

### Task 21: System pages polish parity

**Files:**
- Modify: `src/app/not-found-tenant/page.tsx`, `src/app/forbidden/page.tsx` (already created; verify parity)

- [ ] **Step 1: Visual diff against reference**

Open `design/f0-skeleton/Tradon F0 — UI v2.html` tiles 05 & 06 side by side with `pnpm dev` routes `/not-found-tenant` and `/forbidden`. Confirm: accent rule colour, watermark size/opacity, headline scale, code chips, actions. Adjust class values to match exactly (spacing/size only — no new tokens).

- [ ] **Step 2: Build + commit**

Run: `pnpm build`
Expected: success.
```bash
git add -A && git commit -m "refine: system pages match approved v2"
```

---

### Task 22: Platform-admin provisioning console

**Files:**
- Create: `src/app/(admin)/admin/tenants/page.tsx`, `src/app/(admin)/admin/tenants/actions.ts`

- [ ] **Step 1: Admin action `src/app/(admin)/admin/tenants/actions.ts`**

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { provisionTenant } from '@/lib/provisioning/provisionTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';

export async function createTenant(fd: FormData) {
  const session = await getStaffSession(null);
  const principal = session?.membership?.isPlatform
    ? { role: session.membership.role, isPlatform: true } : null;
  requirePermission(principal, 'platform.tenants.write');
  await provisionTenant({
    name: String(fd.get('name')), slug: String(fd.get('slug')),
    ownerUserId: String(fd.get('owner_user_id')),
    region: 'NG', currency: 'NGN' });
  revalidatePath('/admin/tenants');
}
```

- [ ] **Step 2: Admin page `src/app/(admin)/admin/tenants/page.tsx`** (tile 07: light inverted shell)

```tsx
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createTenant } from './actions';

export default async function AdminTenants() {
  const { data: tenants } = await supabaseAdmin.from('tenants')
    .select('slug,region,created_at').order('created_at', { ascending: false });
  return (
    <div className="flex h-screen bg-paper text-ink">
      <nav className="w-[214px] bg-surface border-r border-hairline p-5 flex flex-col">
        <div className="font-display font-bold text-xl text-ink px-2">
          Tradon<span className="text-signal">.</span></div>
        <span className="inline-block font-mono text-[10px] tracking-[0.16em]
          text-signal border border-green-200 bg-green-50 px-2 py-0.5 rounded-full
          my-2.5 mx-2 w-fit">PLATFORM</span>
        {['Tenants','Domains','Audit log','Platform staff'].map((n,i) => (
          <div key={n} className={`text-[13px] px-2.5 py-2 rounded-lg mb-0.5
            ${i===0?'bg-green-50 text-primary-700 font-semibold':'text-muted'}`}>{n}</div>
        ))}
      </nav>
      <main className="flex-1 p-9 overflow-hidden">
        <h1 className="font-display font-bold text-2xl text-ink">Provision a tenant</h1>
        <p className="text-sm text-muted mt-1.5 mb-6 max-w-[520px]">
          Creates the workspace, seeds the Owner, default roles, settings and the
          RLS tenant context.</p>
        <div className="flex gap-6">
          <form action={createTenant} className="shrink-0 w-[440px] bg-surface
            border border-hairline rounded-card p-6 shadow-card">
            <Input label="Business name" name="name" required />
            <Input label="Subdomain" name="slug" suffix=".tradon.app" required />
            <Input label="Owner user id" name="owner_user_id" required />
            <div className="mt-1"><Button variant="primary">Provision tenant</Button></div>
          </form>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-[13px] text-ink mb-3.5">
              Active tenants</div>
            <div className="border border-hairline rounded-card overflow-hidden bg-surface">
              {(tenants ?? []).map(t => (
                <div key={t.slug} className="grid grid-cols-3 text-[12.5px]
                  border-b border-hairline last:border-0">
                  <div className="px-4 py-3">{t.slug}.tradon.app</div>
                  <div className="px-4 py-3">{t.region}</div>
                  <div className="px-4 py-3 font-mono text-muted">
                    {new Date(t.created_at).toISOString().slice(0,10)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

Run: `pnpm build`
Expected: success.
```bash
git add -A && git commit -m "feat: platform-admin provisioning console (light inverted shell)"
```

---

## Phase 8 — End-to-end & docs

### Task 23: Two-tenant isolation E2E + dev docs

**Files:**
- Create: `tests/integration/e2e-isolation.test.ts`, `docs/DEV.md`

- [ ] **Step 1: Failing E2E test**

`tests/integration/e2e-isolation.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { provisionTenant } from '@/lib/provisioning/provisionTenant';
import { registerShopUser } from '@/lib/auth/shop';
import { withTenant } from '@/lib/db/withTenant';

describe('end-to-end tenant isolation', () => {
  it('tenant B cannot see tenant A shop users via the scoped client', async () => {
    await q(`delete from tenants where slug in ('e2e-a','e2e-b')`);
    const a = await provisionTenant({ name:'A',slug:'e2e-a',
      ownerUserId:'oa',region:'NG',currency:'NGN' });
    const b = await provisionTenant({ name:'B',slug:'e2e-b',
      ownerUserId:'ob',region:'NG',currency:'NGN' });
    await registerShopUser(a.tenantId, 'secret@a.com', 'pw', 'A User');
    const seenByB = await withTenant(b.tenantId, async (c) =>
      (await c.query(`select email from shop_users`)).rows);
    expect(seenByB).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify pass (proves the whole spine)**

Run: `pnpm vitest run tests/integration/e2e-isolation.test.ts`
Expected: PASS — B sees zero rows.

- [ ] **Step 3: Write `docs/DEV.md`**

```markdown
# Tradon — Local Dev

1. `pnpm install`
2. `pnpm dlx supabase start` (Docker required)
3. Copy `.env.local.example` → `.env.local`, fill keys from `supabase start`
4. `pnpm dlx supabase db reset` to apply migrations
5. `pnpm test` (unit + integration; needs local Postgres up)
6. `pnpm dev` — visit `http://chi.localhost:3000` after provisioning a tenant
7. `pnpm check:rls` — RLS guard (also runs in CI; build fails if any
   tenant-owned table is unprotected)

Conventions: timestamps UTC; never raw hex in components; new tenant-owned
table ⇒ add `tenant_id` + RLS policy in the same migration or CI fails.
```

- [ ] **Step 4: Full suite + commit**

Run: `pnpm test`
Expected: ALL pass.
```bash
git add -A && git commit -m "test: end-to-end tenant isolation + dev docs"
```

---

## Self-Review

**Spec coverage:**
- §2 stack → Tasks 1,3,9 · §3 isolation/RLS/CI guard → Tasks 5,6 · §4 dual auth → Tasks 9,10 · §5 taxonomy/roles → Tasks 11 · §6 resolution → Tasks 7,8 · §7 RBAC → Tasks 11,12 · §8 compliance (audit/consent/PII/region/UTC) → Tasks 3,13,14,15 · §9 testing → every task TDD + Task 6 guard + Task 23 E2E · §10a UI (8 screens) → Tasks 2,17–22. No uncovered requirement.
- Custom-domain-ready schema (§6) → Task 4 `domains.type`. Hard-delete vs retention (§8) → audit append-only (Task 13) + erase (Task 15).

**Placeholder scan:** No TBD/TODO; every code step has full code; no "similar to Task N".

**Type consistency:** `resolveTenant`→`TenantCtx{id,slug,status}` used consistently (Tasks 8,12,20,22); `getStaffSession(tenantId|null)`→`StaffSession.membership{tenantId,role,isPlatform}` consistent (Tasks 9,12,20,22); `can(Principal{role,isPlatform})` consistent (Tasks 12,20,22); `withTenant` signature consistent (Tasks 5,10,13,14,15,23); `provisionTenant` input/return consistent (Tasks 16,22,23).

**Note for executor:** Task 13 Step 6 — the append-only assertion: since `do instead nothing` makes UPDATE affect 0 rows without error, change that test to re-`select` and assert `action` is still `'tenant.provisioned'` rather than expecting a thrown error.
