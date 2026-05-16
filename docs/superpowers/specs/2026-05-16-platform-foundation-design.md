# Tradon — F0: Platform Foundation (Design)

**Date:** 2026-05-16
**Status:** Approved (brainstorming) — pending written-spec review
**Sub-project:** F0 of the Tradon decomposition (the spine; everything depends on it)

---

## 1. Scope & Purpose

F0 ships **no end-user features**. Its deliverable is a deployable
Next.js + Supabase application where:

- A Tradon platform admin can provision a tenant.
- That tenant resolves by subdomain (`<slug>.tradon.app`).
- Tenant staff can log in with role/permission-based access.
- A shop end-user can register/log in **scoped to a single tenant**.
- **Every** data access is tenant-isolated at the database (RLS).
- Sensitive actions are audited; PII deletion/export is structurally possible.

**Definition of done:** a second tenant cannot, by any code path, read or
write the first tenant's data — proven by automated tests, including a CI
check that fails if any tenant-owned table lacks RLS.

### Explicitly out of scope (later sub-projects)
Products, orders, distributors, finance, reporting, dashboard, shop features,
field-rep features, custom-domain verification/SSL, self-serve signup,
billing/pricing, and all compliance *features* (consent UX, DSAR fulfillment
UI, breach-notification process, payment/CBN compliance). F0 builds only the
*structural primitives* for these.

---

## 2. Technology Foundation

| Concern | Choice |
|---|---|
| App framework | **Next.js (App Router)**, single app |
| API | Next.js route handlers + server actions (server-side Supabase client). No separate service yet; Hono extraction available later if a domain needs it. |
| Database / Auth / Storage | **Supabase** — Postgres + RLS, Supabase Auth (staff/admin only), Storage (later) |
| Hosting | Vercel (Next.js, native multi-domain for later custom domains) + Supabase managed Postgres |

Route groups: `(landing)`, `(tenant)` back-office, `(shop)`, `(admin)`.

---

## 3. Multi-Tenancy & Data Isolation

**Strategy: Shared schema + `tenant_id` + Postgres RLS** (Approach A).
Rationale: standard for this SaaS class, plays to Supabase's strengths,
cheapest to operate/migrate; B/C deferred and would be provisioning-only
changes if an enterprise isolation tier is ever needed.

- Every tenant-owned table: `tenant_id uuid not null references tenants(id)`.
- Per-request Postgres session variable `app.current_tenant_id` set from
  resolved tenant context; helper `current_tenant_id()`.
- RLS enabled on every tenant-owned table with policy
  `using (tenant_id = current_tenant_id())` (and matching `with check`).
- **CI guard:** an automated test scans the schema and **fails if any
  tenant-owned table lacks RLS enabled + the required policy** — closes the
  "forgot a policy = leak" hole structurally.
- Platform-admin access uses a separate, explicit bypass path/role — never
  the tenant resolution path.

---

## 4. Identity & Authentication

Two distinct auth subsystems:

- **Tenant staff & platform staff → Supabase Auth.** Global-unique email is
  acceptable (few users). `tenant_members` links a Supabase `auth.users` id
  → `tenant_id` + `role`. Platform staff are flagged separately, no
  `tenant_id`, and resolve through a **permission-aware layer** (not a raw
  boolean) using a distinct permission namespace.
- **Shop end-users → app-managed credentials.** Table
  `shop_users(tenant_id, email, password_hash, …)` with
  **`unique(tenant_id, email)`** — the same email can have independent
  accounts at different tenant shops, honoring per-tenant identity. Sessions
  are signed, tenant-scoped, HTTP-only cookies.
- **Distributor is not a user type** — it is a status on a `shop_user`
  within a tenant. The application/approval flow is a later sub-project; F0
  only models the nullable relationship.

---

## 5. User-Type Taxonomy (canonical platform reference)

- **Platform staff** (`app.tradon.app`): future role + permission system with
  custom permissions. F0 routes them through the shared `can()` layer with a
  distinct permission namespace (e.g. `platform.tenants.write`) and a minimal
  seeded `Superadmin` role. No platform-RBAC *features* built in F0.
- **Tenant staff** (`tenant_members.role`): **Owner, Admin, Finance, Sales,
  Field rep, Viewer**. *Field rep* is a first-class staff role; future
  features (assigned distributor visits, tasks, field reporting) are a later
  sub-project. F0 only seeds the role + permission keys.
- **Shop users** (`shop_users`, per-tenant): status `customer` or
  `distributor` (distributor = tenant-approved; flow is later).

---

## 6. Tenant Resolution Flow

1. Edge middleware reads the `Host` header.
2. `<slug>.tradon.app` → look up `tenants` by slug. A `domains` table is
   modeled now with a `type` column (`subdomain` | future `custom`);
   resolution code queries it **generically**, so custom domains are a later
   add-on with **zero rearchitecting**.
3. No match / inactive tenant → tenant-not-found (404) page.
4. Match → tenant context (id, slug, status) attached to the request; RLS
   session variable set for all DB calls in that request.
5. Root / `app.tradon.app` with no tenant → landing/admin routing.

---

## 7. RBAC

- **Shared permission-check infrastructure** used by *both* tenant staff and
  platform staff, with **two permission namespaces** (tenant vs platform).
- Enforcement is **always a permission check** (`can(user, 'finance.write')`),
  never a role-name check.
- Role → permission maps are **data-driven**, so tenant-custom roles and
  custom platform permissions can be added later with **zero call-site
  changes**.
- Seeded tenant roles: Owner, Admin, Finance, Sales, Field rep, Viewer.
  Seeded platform role: Superadmin.
- F0 ships: invite staff, assign role, enforce permissions on a couple of
  placeholder protected routes to prove the layer end-to-end.

---

## 8. Compliance Scaffolding (structural primitives only)

Relevant regimes: **Nigeria NDPA 2023 / NDPR** (launch), **GDPR / UK-GDPR**
(potential expansion), US state laws (CCPA-style). All overlap on the
primitives below. No compliance *features* in F0 — only the structure that is
cheap now and ruinous to retrofit.

1. **Data residency awareness** — `region` attribute on `tenants` + a
   deliberate initial Supabase region. Multi-region not built; later EU
   residency becomes a routing problem, not a rearchitecture.
2. **PII tagging + erasure/export by design** — a convention marking personal
   -data columns; "delete/export everything for this user / this tenant" are
   first-class operations leveraging existing isolation.
3. **Append-only audit log** — tamper-evident `audit_log` (who, what, when,
   tenant, before/after) for auth events, role/permission changes, and access
   to sensitive data.
4. **Consent & policy versioning** — record which Terms/Privacy version each
   user (staff + shop) accepted and when.
5. **Hard-delete vs retention** — deletion semantics modeled at schema time
   so erasure truly deletes while financial/legal records honor retention.
6. **UTC + per-tenant currency/locale** — all timestamps UTC; `currency`
   (NGN default) and `locale` on `tenants`.

Adds ~3 small tables (`audit_log`, consent/policy-acceptance, PII metadata
convention) plus a few `tenants` columns.

---

## 9. Testing Strategy

Built test-first (TDD skill) at implementation time.

- **RLS isolation (highest priority):** two seeded tenants; assert every
  tenant-owned table denies cross-tenant read/write; schema-scanning CI test
  that fails on any unprotected tenant table.
- **Auth:** staff Supabase login + membership resolution; shop
  `(tenant, email)` uniqueness allowing the same email across tenants;
  session scoping; platform staff via the permission-aware layer.
- **Tenant resolution:** subdomain match, unknown host, inactive tenant,
  generic `domains` lookup.
- **RBAC:** permission grants/denials per role via `can()`, for both tenant
  and platform namespaces.
- **Compliance primitives:** audit-log writes on sensitive actions;
  per-user/per-tenant erasure + export operations; consent-version recording.

---

## 10. Decision Log

| Decision | Choice |
|---|---|
| Stack | Next.js App Router + Supabase + Next.js API (Hono later) |
| Identity scope | Per-tenant shop accounts |
| RBAC | Fixed roles + permission-check layer (custom roles later) |
| Provisioning | Admin-provisioned now; self-serve later (with Billing) |
| Custom domains | Subdomains in F0; custom-domain-ready schema |
| Auth structure | Split: Supabase Auth (staff/admin), app-managed shop auth keyed by (tenant, email) |
| Isolation | Shared schema + `tenant_id` + RLS (Approach A) |
| Platform staff | Permission-aware via shared `can()` layer, distinct namespace |
| Field rep | First-class tenant role; features later |
| Compliance | All 6 structural primitives in F0; features deferred |
| UI scope | Thin UI skeleton **in scope**, design-first (approved v2) |

---

## 10a. UI Scope (added 2026-05-16)

F0 includes a thin, full-fidelity UI skeleton — designed and approved before
implementation, built with Tailwind from `design/brand-spec.md` tokens.

**Approved reference:** `design/f0-skeleton/Tradon F0 — UI v2.html`
**Brand tokens:** `design/brand-spec.md` (Field Green)

In-scope screens (no feature pages):

1. Staff login (Supabase Auth) — split-screen
2. Shop login (app-managed, per-tenant) — split-screen
3. Shop signup — split-screen, NG defaults, consent-version capture
4. Authenticated app shell (sidebar + topbar + content frame) — inherited by
   every later sub-project; F0 renders a "Foundation ready" state
5. Tenant-not-found / inactive page
6. 403 no-permission page (names the missing permission key)
7. Platform-admin provision-tenant console (light, inverted shell)
8. Tailwind component foundation (buttons, inputs, role/status badges, alerts)

Implementation contract: tokens → CSS custom properties → `tailwind.config`
theme; components use semantic classes (`bg-primary`, `text-muted`), never raw
hex. Backend built test-first; these screens built to match the approved v2.

---

## 11. Build Order Context

Tradon decomposition build order:
**F0 (this) → Products → Distributors & credits → Orders → Shop MVP →
Finance/Reporting/Dashboard → Billing & Pricing → Admin/Landing.**
Each sub-project gets its own spec → plan → implementation cycle.
