# Tradon — Distributors & Credits Design

**Date:** 2026-05-18
**Status:** Approved (brainstorming) — pending written-spec review
**Sub-project:** Distributors & credits — third sub-project, after F0 + Products (both complete on `master`).
**Builds on:** F0 (`docs/superpowers/specs/2026-05-16-platform-foundation-design.md`) and Products (`docs/superpowers/specs/2026-05-17-products-design.md`).

---

## 1. Scope & Purpose

Tenant-side distributor management + an auditable credit system on the F0/Products foundation.

**In scope:**
- `distributors` entity (1:1 with a per-tenant `shop_users` row), profile, lifecycle status machine.
- Tenant-side approval queue: approve / reject / suspend / reactivate / archive.
- Credit: configurable `credit_limit` + append-only `credit_movements` ledger + cached `outstanding`, DB-enforced single write path.
- Domain modules + RBAC-gated server actions.
- Distributors list, distributor detail, approval queue, credit-management UI inside the F0 AppShell, design-first (approved static design before implementation).

**Definition of done:** a `distributors.write` user can manage distributors and their credit; `outstanding` is provably drift-free vs the `credit_movements` ledger and can never be `< 0` or `> credit_limit`; `purchase_draw` is rejected unless the distributor is `active`; another tenant cannot read or mutate any of it (RLS, auto-enforced by the F0 `rls-guard`).

**Out of scope (later sub-projects):** shop-side "apply to become a distributor" UI (Shop MVP — it will simply insert a `pending` distributor + shop_user into the queue this sub-project builds); Orders consuming credit at checkout (Orders — this sub-project exposes `record_credit_movement` as the primitive Orders calls, exactly like Products' `record_stock_movement`); distributor wallet/payout (Shop); per-distributor reporting (Reporting); assigned field-rep visits/tasks (later).

---

## 2. Data Model — 2 new tables, both RLS-protected

Every tenant-owned table carries `tenant_id uuid not null`; the F0 `tests/integration/rls-guard.test.ts` fails the build if any lacks a `current_tenant_id()` policy.

### `distributors`
- `id uuid pk default gen_random_uuid()`
- `tenant_id uuid not null` (RLS key)
- `shop_user_id uuid not null references shop_users(id)` — the distributor's account identity
- `business_name text not null`
- `region text` (nullable; feeds future dashboard/reporting)
- `address text` (nullable)
- `credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0)`
- `outstanding numeric(14,2) not null default 0 check (outstanding >= 0 and outstanding <= credit_limit)`
- `status text not null check (status in ('pending','active','suspended','archived')) default 'pending'`
- `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
- `unique (tenant_id, shop_user_id)`
- RLS: `using/with check (tenant_id = current_tenant_id())`; grants select/insert/update to `anon` (no delete — archive only).

Tenant creating a distributor for someone with no shop account yet provisions a `shop_users` shell row. Since F0's `shop_users.password_hash` is `NOT NULL`, the shell is written with a non-null **unusable sentinel hash** (a constant that no bcrypt verify can match, e.g. `'!shell'`); the real password/activation is a Shop-MVP concern (Shop MVP detects the sentinel and forces set-password). `shop_users.status` is set to `'distributor'` when the distributor becomes `active`.

### `credit_movements` (append-only — exact F0 `audit_log` / Products `stock_movements` pattern)
- `id uuid pk default gen_random_uuid()`
- `tenant_id uuid not null` (RLS key; **FK-free**, per the F0 audit_log precedent — FK + `do instead nothing` rules conflict in Postgres)
- `distributor_id uuid not null references distributors(id)`
- `type text not null check (type in ('purchase_draw','repayment','adjustment'))`
- `delta numeric(14,2) not null check (delta <> 0)`
- `reason text`
- `actor text not null`
- `created_at timestamptz not null default now()`
- index `(tenant_id, distributor_id, created_at)`
- RLS as above; `revoke update, delete from anon, authenticated`; `grant select, insert to anon`; `create rule … do instead nothing` for UPDATE and DELETE; `revoke truncate from anon, authenticated, service_role`.

**Sign convention:** `purchase_draw` = `+delta` (raises `outstanding`); `repayment` = `-delta`; `adjustment` = `±`. Invariant: `outstanding = Σ deltas`. `credit_limit` is a field on `distributors`; its changes are **not** ledger rows — they are recorded via F0 `audit_log` (`writeAudit`, action `distributor.credit_limit_changed`, `{ old, new }` in meta), keeping the ledger strictly about owed amounts.

---

## 3. Credit Integrity Mechanism

Single sanctioned write path — SQL function:

```
record_credit_movement(p_distributor_id uuid, p_type text,
                        p_delta numeric, p_reason text, p_actor text)
```

Atomically, in one statement, it: (a) validates the distributor belongs to `current_tenant_id()`; (b) for `p_type='purchase_draw'` requires the distributor `status='active'` (raises otherwise — `repayment` and `adjustment` are allowed for any non-archived status so debt can always be paid down); (c) inserts the `credit_movements` row; (d) `update distributors set outstanding = outstanding + p_delta, updated_at = now()`. The `outstanding >= 0 and outstanding <= credit_limit` CHECK aborts the whole transaction if a movement would push the balance negative or over the limit — the financially critical guard, structurally enforced (analogous to Products' `current_quantity >= 0`).

A `BEFORE INSERT` trigger on `credit_movements` raises unless the insert originates from `record_credit_movement` (a transaction-local session flag, exactly like Products' `record_stock_movement`/`stock_movements_guard`), so ledger↔`outstanding` drift is structurally impossible. The function is `security definer`, `search_path = public`, granted `execute` to `anon`; callable via `withTenant`.

Orders (later sub-project) draws credit at checkout by calling this same function — no second path.

Known/accepted pattern note: same anon-scoped trigger guard as Products (`current_user='anon'` + flag), with the same documented, bounded service_role/superuser exemption (no app code writes `credit_movements` except via the function).

---

## 4. Domain / Service Layer — `src/lib/distributors/`

Focused, independently testable server modules; all tenant-scoped via the existing `withTenant`:

- `distributors.ts` — `createDistributor` (designate an existing shop_user, or provision a shop_user shell), `updateDistributor` (profile fields), `setStatus` (approve/reject/suspend/reactivate/archive — enforces valid transitions; activating also sets `shop_users.status='distributor'`; writes F0 audit), `setCreditLimit` (updates the field + `writeAudit` `distributor.credit_limit_changed`; rejects a new limit below current `outstanding`), `listDistributors(filter)`, `getDistributor`.
- `credit.ts` — `recordCreditMovement(...)` (invokes the SQL function), `listCreditMovements(distributorId)`.
- `stats.ts` — `distributorStats()` → `{ totalActive, pendingCount, totalOutstanding, overLimitCount }` (overLimit = active distributors at/above a near-limit threshold; precise definition: `outstanding >= credit_limit` count for the header card).
- `activity.ts` — `listDistributorActivity(distributorId)` → reads the existing F0 `audit_log` (no new table) tenant-scoped via `withTenant`, filtered to `target = distributorId`, newest first: `{ action, actor, meta, created_at }[]`. Surfaces `distributor.status_changed` + `distributor.credit_limit_changed` (who, old→new, when) for the detail page Activity tab. `actor` is the staff user-id; friendly-name resolution is a flagged later follow-up (not in this sub-project).

No module reaches outside its table set; each answers what/how/depends-on cleanly.

**Status transition matrix** (enforced in `setStatus`): `pending → active | archived(reject)`; `active → suspended | archived`; `suspended → active | archived`; `archived` is terminal. Invalid transitions raise.

---

## 5. RBAC & Access

Reuses F0 `can()` / `requirePermission` with the **already-seeded** keys (`src/lib/rbac/permissions.ts`): `distributors.read` — list, detail, credit history, approval queue, stats; `distributors.write` — create/edit, all status transitions, set credit limit, record credit movements. Server actions call `await requirePermission(...)` (the awaited gate, F0/Products precedent) before any mutation; routes session-gated like F0 `/app` (resolveTenant → getStaffSession → requirePermission). Every credit movement records `actor`; status transitions and limit changes additionally `writeAudit` to the F0 append-only audit log.

---

## 6. UI (design-first, like F0/Products)

Routes inside the existing F0 **AppShell** ("Distributors" nav item active):

- **`/app/distributors`** — header stat cards (Active / Pending / Total outstanding / Over-limit), filterable + searchable table (business name, region, status badge, credit limit, outstanding, available = `limit − outstanding`), row actions (view, approve if pending, suspend/reactivate, set limit).
- **Approval queue** — `pending` distributors with Approve / Reject.
- **Distributor detail** `/app/distributors/[id]` — a **tabbed** page:
  - **Overview** — business details, contact, location (region/address), credit summary cards (limit / outstanding / available), and status actions (approve/reject/suspend/reactivate/archive).
  - **Credit** — set limit (inline), record repayment/adjustment, and the `credit_movements` ledger newest-first **with an actor column** (the `actor` already stored on every movement).
  - **Activity** — the per-distributor audit view from F0 `audit_log` via `listDistributorActivity`: status changes + credit-limit changes showing who / old→new / when.
  - **Orders** — deferred placeholder, structurally slotted ("arrives with the Orders sub-project"); no Orders backend in this sub-project.

Built on the locked Field Green tokens and the responsive patterns + table style established in Products (muted secondary figures, segmented controls, mobile-correct, semantic Tailwind only — no raw hex). An approved static design for these screens is produced and signed off **before** implementation (the one human gate), then built to that reference as semantic-Tailwind components (server components except where interactivity requires `'use client'`).

---

## 7. Testing Strategy (TDD)

Test-first per task, on local Supabase (port **54332**, never 54322); test files serial (`fileParallelism:false`); Vitest loads `.env.local`.

- **RLS isolation** — two-tenant tests for `distributors` + `credit_movements`; F0 `rls-guard` auto-covers them (build fails if unprotected).
- **Credit integrity** — ledger row + `outstanding` move atomically; over-limit draw rejected (tx aborts, `outstanding` unchanged); negative `outstanding` rejected; `purchase_draw` rejected when status ≠ `active`; `repayment` allowed when `suspended`; direct `credit_movements` insert (bypassing the function) rejected by the trigger; append-only (UPDATE/DELETE no-op, TRUNCATE denied to app roles — mirrors F0 audit); **concurrency** — parallel `purchase_draw`s never desync ledger↔`outstanding` and never exceed `credit_limit`.
- **Domain** — status transition matrix (valid allowed, invalid raises); activating sets `shop_users.status='distributor'`; `setCreditLimit` writes the F0 audit row and rejects a limit `< outstanding`; create-via-existing-shop_user vs create-with-shell.
- **Activity** — `listDistributorActivity` returns the F0 `audit_log` rows for that distributor (status + limit changes) newest-first with actor/meta, tenant-scoped (a second tenant sees none).
- **Stats** — counts/sums correct (active, pending, total outstanding, over-limit boundary).
- **RBAC** — `distributors.read` cannot mutate; `distributors.write` can; routes gated; movement actions awaited-gated.
- **E2E** — create distributor → set limit → `purchase_draw` (Orders-style) → over-limit draw rejected → `repayment` → suspend blocks further draw → archive; two-tenant isolation throughout; non-vacuous (tenant A proven populated before tenant B asserted empty).

---

## 8. Decision Log

| Decision | Choice |
|---|---|
| Scope | Tenant-side core; shop-apply / Orders-consume / wallet / reporting deferred (credit-draw primitive exposed for Orders) |
| Distributor model | Separate `distributors` table, 1:1 with a per-tenant `shop_user`; tenant designates an existing shop_user or provisions a shop_user shell |
| Credit | `credit_limit` field + append-only `credit_movements` ledger + cached `outstanding`; invariant `outstanding = Σ deltas` |
| Integrity | `record_credit_movement` DB fn + trigger; CHECK `0 ≤ outstanding ≤ credit_limit`; `purchase_draw` requires `active`; repayment/adjustment any non-archived status |
| Limit changes | `credit_limit` field update audited via F0 `audit_log` (not a ledger row); new limit cannot be below current `outstanding` |
| Lifecycle | `distributors.status` pending→active→suspended/archived state machine; archive, never hard-delete |
| Detail page | Tabbed: Overview / Credit (ledger w/ actor column) / Activity (F0 audit_log per distributor) / Orders (deferred placeholder, slotted) |
| Activity view | `listDistributorActivity` reads existing F0 `audit_log` (no new table); actor shown as user-id, friendly-name resolution = flagged later follow-up |
| Foundation reuse | tenant_id+RLS, `withTenant`, append-only FK-free ledger pattern, `record_*` fn+trigger (anon-scoped, documented), `writeAudit` + `audit_log` read, RBAC keys already seeded, AppShell, Field Green, TDD, on `master`, port 54332 |

---

## 9. Build-Order Context

Tradon decomposition: F0 (done) → Products (done) → **Distributors & credits (this)** → Orders → Shop MVP → Finance/Reporting/Dashboard → Billing → Admin/Landing. Each sub-project: spec → plan → subagent-driven build on `master` (no worktree, per standing preference). Orders will consume the `record_credit_movement` primitive defined here.
