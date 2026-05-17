# Tradon — Products (core) Design

**Date:** 2026-05-17
**Status:** Approved (brainstorming) — pending written-spec review
**Sub-project:** Products — the first feature module, second sub-project after F0.
**Builds on:** F0 Platform Foundation (`docs/superpowers/specs/2026-05-16-platform-foundation-design.md`), complete on `master`.

---

## 1. Scope & Purpose

A working tenant **product catalog + inventory** on the F0 foundation.

**In scope:**
- Product CRUD (create / edit / archive) with SKU, pricing, cost, unit, reorder threshold, category, image.
- Categories: lightweight tenant-scoped entity **with a management UI** (list / create / rename / archive).
- Stock: append-only movement ledger (receipt / adjustment / sale / return) + denormalized `current_quantity`, integrity DB-enforced.
- Product images stored in **Cloudflare R2** behind a swappable `StorageAdapter`.
- Stat cards: total active products, low-stock count, inventory value.
- Products UI + Categories UI inside the existing F0 `AppShell`, design-first (approved static design before build).

**Definition of done:** a `products.write` user can manage a catalog, categories, images and stock; `current_quantity` is provably drift-free vs the ledger; another tenant cannot read or mutate any of it (RLS, auto-enforced by the F0 `rls-guard`).

**Out of scope (later):** promos/variants, delivery-fee rules, weighted-average cost, multi-warehouse, Orders integration (Products only exposes the stock primitive Orders will later call), product-image transformations/thumбnailing service.

---

## 2. Data Model — 3 new tables, all RLS-protected

Every tenant-owned table carries `tenant_id uuid not null references tenants(id)`; the F0 `tests/integration/rls-guard.test.ts` fails the build if any lacks a `current_tenant_id()` policy.

### `categories`
`id uuid pk`, `tenant_id`, `name text not null`, `status text not null check (status in ('active','archived')) default 'active'`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
Constraint: `unique (tenant_id, lower(name))` (case-insensitive per tenant).
RLS: `using/with check (tenant_id = current_tenant_id())`; grants select/insert/update to `anon` (no delete — archive only).

### `products`
`id uuid pk`, `tenant_id`, `sku text not null`, `name text not null`, `category_id uuid null references categories(id)`, `selling_price numeric(14,2) not null check (>= 0)`, `cost_price numeric(14,2) not null default 0 check (>= 0)`, `unit text not null default 'unit'`, `reorder_threshold int not null default 0 check (>= 0)`, `current_quantity int not null default 0 check (current_quantity >= 0)`, `status text not null check (status in ('active','archived')) default 'active'`, `image_key text null` (R2 object key; signed/CDN URL derived at read), `created_at`, `updated_at`.
Constraint: `unique (tenant_id, sku)`.
RLS as above; grants select/insert/update to `anon` (no delete — archive only).
**Variant-ready:** a future `product_variants(product_id …)` table attaches without changing this schema.

### `stock_movements` (append-only, like F0 `audit_log`)
`id uuid pk`, `tenant_id`, `product_id uuid not null references products(id)`, `type text not null check (type in ('receipt','adjustment','sale','return'))`, `qty_delta int not null check (qty_delta <> 0)`, `unit_cost numeric(14,2) null` (captured for future weighted-average cost), `reason text`, `actor text not null`, `created_at timestamptz default now()`.
Index `(tenant_id, product_id, created_at)`.
RLS as above. Append-only enforced exactly as F0 audit: `do instead nothing` rules for UPDATE/DELETE, `revoke truncate … from anon, authenticated, service_role`, grant select/insert to `anon`.

---

## 3. Stock Integrity Mechanism

Single sanctioned write path — SQL function:

```
record_stock_movement(p_product_id uuid, p_type text, p_qty_delta int,
                       p_unit_cost numeric, p_reason text, p_actor text)
```

In one atomic statement it: (a) validates the product belongs to `current_tenant_id()` and is not archived; (b) inserts the `stock_movements` row; (c) `update products set current_quantity = current_quantity + p_qty_delta, updated_at = now()`. The `products.current_quantity >= 0` CHECK makes any movement that would drive stock negative abort the whole transaction. `qty_delta <> 0` CHECK rejects no-op movements.

A `BEFORE INSERT` trigger on `stock_movements` raises unless the insert originates from `record_stock_movement` (a session-local flag set by the function), so the ledger cannot be written — and thus `current_quantity` cannot drift — by any other path. Product creation with an opening quantity calls `record_stock_movement(... 'receipt' ...)` rather than writing `current_quantity` directly (no special cases).

Function is `security definer` scoped to the tenant via `current_tenant_id()`; callable by `anon` through `withTenant`.

---

## 4. Domain / Service Layer — `src/lib/products/`

Focused, independently testable server modules; all tenant-scoped via the existing F0 `withTenant`:

- `products.ts` — `createProduct`, `updateProduct`, `archiveProduct`, `listProducts(filter)`, `getProduct`.
- `categories.ts` — `listCategories`, `createCategory`, `renameCategory`, `archiveCategory`, `getOrCreateCategory(name)` (inline-create from product form).
- `stock.ts` — `recordStockMovement(...)` (invokes the SQL function), `listMovements(productId)`.
- `stats.ts` — `productStats()` → `{ totalActive, lowStockCount, inventoryValue }`
  (lowStock = `status='active' and current_quantity <= reorder_threshold`; inventoryValue = `Σ current_quantity * cost_price` over active).
- `storage/` — see §5.

No module reaches outside its own table set; each answers what/how/depends-on cleanly.

---

## 5. Storage Architecture (product images)

**`StorageAdapter` interface** (`src/lib/products/storage/adapter.ts`):
`putUrl(key, contentType) -> presigned PUT URL`, `publicUrl(key) -> string`, `deleteObject(key) -> void`.

- **R2 adapter** (`r2.ts`) — `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. Browser uploads bytes directly via a server-issued **presigned PUT** (server never proxies image bytes). Read URLs derived from `R2_PUBLIC_BASE_URL` (Cloudflare CDN). Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`.
- **Fake adapter** (`fake.ts`) — in-memory map; used by ALL tests and local dev. Provider chosen by env: R2 when its env vars are present, otherwise fake (so CI/local need no R2 and stay hermetic).
- **Key convention:** `tenants/<tenant_id>/products/<product_id>/<uuid>.<ext>` — tenant-scoped paths (defense-in-depth; R2 is not RLS-aware, access is via signed/CDN URLs).
- **Server-side validation before presign:** content-type ∈ {image/jpeg, image/png, image/webp}; max ~5 MB; one image per product (replacing deletes the prior key). The product row stores only `image_key`.

Flow: client requests upload slot → server `requirePermission('products.write')`, validates, returns presigned PUT + key → client PUTs to R2 → client confirms → server sets `products.image_key`.

---

## 6. RBAC & Access

Reuses F0 `can()` / `requirePermission` (keys `products.read`, `products.write` already seeded in `src/lib/rbac/permissions.ts`):
- `products.read` — view products list, stats, detail, categories, movement history.
- `products.write` — create/edit/archive products, manage categories, request image-upload slots, record stock movements.
Server actions call `await requirePermission(...)` before any mutation; the `/app/products` and category routes are session-gated like F0 `/app` (resolveTenant → getStaffSession → requirePermission). Every stock movement records `actor` (acting user id); `adjustment` requires a non-empty `reason`.

---

## 7. UI (design-first, like F0)

Routes inside the existing F0 **AppShell** (its "Products" nav item becomes active; a "Categories" entry is reachable from the Products area):

- **`/app/products`** — stat-card row (Total products / Low stock / Inventory value), searchable + filterable (category, status) products **table** (thumbnail, SKU, name, category, selling price, qty with low-stock badge, status), row actions (edit, adjust stock, archive). Empty / loading / low-stock states.
- **Product create/edit** — form (drawer or modal): name, SKU, category (pick or inline-create), selling price, cost price, unit, reorder threshold, opening quantity (create only → initial receipt), image upload (presigned PUT + preview).
- **Stock adjust** — per-product action: type (receipt/adjustment), signed quantity, optional unit cost, reason (required for adjustment); shows recent movement history.
- **`/app/products/categories`** — manage categories: list with product counts, create, rename, archive (archive blocked-safe: archived category hidden from pickers, existing product links retained).

Built on the locked Field Green tokens + the responsive patterns established in F0 (`min-h-[100dvh]`, mobile-correct, semantic Tailwind only, no raw hex). Visual language follows the brand system and `dashboard-screenshot.png`. **Process:** an approved static design for these screens is produced and signed off *before* implementation, then built to that reference (same as F0).

---

## 8. Testing Strategy (TDD)

Test-first per task, on local Supabase (port **54332**, never 54322); test files serial (`fileParallelism:false`); Vitest loads `.env.local`.

- **RLS isolation** — two-tenant tests for `categories`, `products`, `stock_movements`; F0 `rls-guard` auto-covers them (build fails if unprotected).
- **Stock integrity** — ledger row + `current_quantity` move atomically; negative-stock movement rejected (transaction aborts); direct `stock_movements` insert (bypassing the function) rejected by trigger; append-only (UPDATE/DELETE no-op, TRUNCATE denied to app roles, mirroring F0 audit tests); **concurrency** — parallel movements on one product never desync ledger vs cache.
- **Domain** — product CRUD + archive (no hard delete path); category create/rename/archive + `unique(tenant_id, lower(name))` + inline `getOrCreateCategory`; archived category safety.
- **Stats** — low-stock boundary (`<= threshold`), inventory value over active only, archived excluded.
- **Storage** — via fake adapter: presign returns slot, key convention correct, replace deletes prior key, delete on archive policy; validation rejects bad content-type / oversize; provider-selection falls back to fake without R2 env. No network in tests.
- **RBAC** — `products.read` cannot mutate; `products.write` can; routes gated.
- **E2E** — create product (+image +opening stock) → receive → adjust → archive; verify stats and isolation throughout.

---

## 9. Decision Log

| Decision | Choice |
|---|---|
| Scope | Core catalog/inventory/stock/stats + categories-management UI + product images; variant-ready; promos/variants/delivery deferred |
| Stock | Append-only `stock_movements` ledger + denormalized `current_quantity` |
| Price/cost | Selling price + simple `cost_price`; movements carry optional `unit_cost` (future WAC) |
| Categories | Lightweight tenant table **with management UI**; inline-create; archive lifecycle |
| Lifecycle | Archive (status) for products and categories; no hard delete |
| Stock integrity | DB function + trigger, single write path, `current_quantity >= 0` constraint |
| Image storage | `StorageAdapter` + R2 adapter (presigned PUT, CDN read) + in-memory fake for tests/dev; env-selected |
| Foundation reuse | tenant_id+RLS, `withTenant`, `can()`/`requirePermission`, AppShell, brand tokens, append-only pattern, TDD, on `master`, port 54332 |

---

## 10. Build-Order Context

Tradon decomposition: F0 (done) → **Products (this)** → Distributors & credits → Orders → Shop MVP → Finance/Reporting/Dashboard → Billing → Admin/Landing. Each sub-project: spec → plan → subagent-driven build on `master` (no worktree).
