# Orders — Design Spec

**Status:** Approved (design). UI reference pending; HARD STOP for user approval before any plan/backend.
**Date:** 2026-05-19
**Sub-project:** Orders (4th, after F0 + Products + Distributors & credits — all complete on local master)

---

## 1. Scope & Purpose

The tenant-side order system: create, confirm, fulfill, cancel, and return orders. An order records that a customer (and optionally a distributor on credit) bought specific products at specific prices, and — on confirmation — decrements stock and, where applicable, draws distributor credit.

**In scope:** order header + line items; full lifecycle; the three integrity SQL functions; tenant-side list/detail/create UI including logging *external* (off-platform) orders directly as confirmed; RBAC reuse; audit.

**Deferred (explicitly out of this sub-project):**
- Shop cart/checkout flow → Shop MVP sub-project
- Promotions, discounts, product variants, delivery/shipping fees
- Finance & reporting aggregation (Orders only *emits* the ledger movements those modules will read)
- Payment-gateway integration

## 2. Data Model

Two new tables, both tenant-scoped + RLS, following established patterns. **Not** append-only ledgers — orders are mutable state machines — so normal FKs *within the tenant's own mutable tables* are appropriate here (unlike the FK-free `stock_movements` / `credit_movements` ledgers).

### `orders`
- `id`, `tenant_id`
- `shop_user_id` — the customer; **always set** (every order has a buyer)
- `distributor_id` — **nullable**; set only when the order is on-credit to an active distributor
- `channel` ∈ `platform` | `external` (external = logged after-the-fact: phone/manual/off-platform sale)
- `payment_method` ∈ `paid` | `credit`
- `status` ∈ `draft` | `confirmed` | `fulfilled` | `cancelled` | `returned`
- `total` — denormalized sum of line totals; written at create/confirm
- `created_at`, `updated_at`

### `order_items`
- `id`, `order_id` (FK → `orders`, same-tenant), `tenant_id`
- `product_id`
- `quantity`
- `unit_price` — **snapshot** at line creation
- `unit_cost` — **snapshot** at line creation (margin/COGS for later finance module)
- `line_total` = `quantity * unit_price`

**Key decision:** snapshot price *and* cost at line creation. An order is an immutable historical fact once placed; later product-table edits never rewrite order history.

## 3. Order Lifecycle & Effect Timing

```
draft ──confirm──► confirmed ──fulfill──► fulfilled
  │                    │
  │                    ├──cancel──► cancelled
  │                    └──return──► returned
  └──(external orders are created directly as `confirmed`)
```

- **Effects fire on CONFIRM**, not on create. A `draft` has zero side effects (no stock, no credit) — an editable basket.
- **confirm:** decrement stock for every line (`record_stock_movement(..., 'sale', -qty, ...)`); if `payment_method='credit'`, draw distributor credit (`record_credit_movement(..., 'purchase_draw', +total, ...)`).
- **fulfill:** status-only transition (handed-over/delivered). No ledger effect — logistics is future scope.
- **cancel / return:** reverse confirm effects — `record_stock_movement(..., 'return', +qty, ...)` per line, plus a credit reversal if credit was drawn. `cancelled` vs `returned` are distinct statuses for reporting/intent; mechanics are identical.
- **external/filed orders:** created directly as `confirmed`; the same confirm effects fire atomically at creation. This is how a tenant logs a sale that happened off-platform.

## 4. Integrity Mechanism

Three `SECURITY DEFINER` SQL orchestration functions, each running the whole transition **all-or-nothing in one transaction** — mirroring the proven `record_stock_movement` / `record_credit_movement` pattern:

- **`confirm_order(p_order_id, p_actor)`** — re-reads order + items, loops lines calling `record_stock_movement('sale', -qty)`, then if credit calls `record_credit_movement('purchase_draw', +total)`, then sets `status='confirmed'`.
- **`cancel_order(p_order_id, p_actor)`** — reverses: `record_stock_movement('return', +qty)` per line, credit reversal if drawn, `status='cancelled'`.
- **`return_order(p_order_id, p_actor)`** — same reversal mechanics, `status='returned'`.

**Idempotency key = order status.** `confirm_order` raises if status ≠ `draft` (external-create path constructs+confirms atomically). `cancel_order` / `return_order` raise if status not in (`confirmed`, `fulfilled`). A status row can never be double-confirmed or double-reversed.

**Failure = abort.** Insufficient stock trips the existing `current_quantity >= 0` CHECK; credit over-limit trips the existing `0 <= outstanding <= credit_limit` CHECK. Either aborts the *entire* `confirm_order` transaction — no partial stock decrement, no partial credit draw. The existing single-write-path functions and anon-scoped guard triggers remain the only way ledger rows are written; `confirm_order` composes them, it does not bypass them.

## 5. Channel & Payment Gating

- **Customer is always a `shop_user`** (`shop_user_id` never null). Distributor is an *additional* role on the order, not the buyer identity.
- **Stock always decrements on confirm**, regardless of channel or payment method — a sale is a sale.
- **Credit draw is gated:** only when `payment_method='credit'` **and** `distributor_id` non-null **and** that distributor is `active`. `confirm_order` asserts this; a credit order with no/inactive distributor is rejected at confirm.
- **Regular shop-user orders are `paid`** — no credit-ledger effect.
- `channel='external'` only changes the *entry path* (created directly as confirmed); confirm effects are identical to a platform order's.

## 6. RBAC, Audit & UI

- **RBAC reuse:** existing `orders.read` / `orders.write` permission keys (already seeded; Sales role has both). All mutations `await requirePermission('orders.write')`; reads gated by `orders.read`. No new permission keys.
- **Audit:** every confirm/cancel/return calls F0 `writeAudit({action:'order.confirmed'|'order.cancelled'|'order.returned', target:orderId, meta})` → existing append-only `audit_log`. Surfaced in order Activity, consistent with the Distributors pattern.
- **UI — static design reference first, then HARD STOP for user approval before implementation:**
  - **Orders list** — stat cards (counts/value by status) + table (customer, channel, payment, status, total, date), status filter.
  - **Order detail** — header (customer/distributor/channel/payment/status) + line-items table (product, qty, unit price, line total) + lifecycle action buttons (Confirm / Fulfill / Cancel / Return, shown per current status) + Activity.
  - **Create / Log order drawer** — pick customer, optional distributor + credit toggle, add product lines (price prefilled from product, editable), choose Platform draft vs. Log external (creates confirmed).
  - Field Green tokens, semantic Tailwind only, no raw hex; consistent with Products/Distributors UI.

## 7. Testing Strategy

- **Schema/RLS:** `orders` + `order_items` covered by `tests/integration/rls-guard.test.ts` (build fails if a tenant-owned table is unprotected); tenant-isolation assertions.
- **Integrity (core):** `confirm_order` decrements stock per line + draws credit when credit; double-confirm raises (idempotent); insufficient stock aborts the *whole* transaction (assert zero partial stock-movement rows AND no credit row); credit-over-limit aborts wholly; `cancel_order`/`return_order` reverse exactly and are idempotent; non-credit order draws no credit; external-create path fires confirm effects atomically.
- **Domain:** `src/lib/orders/*` — totals from snapshotted prices, status-transition guards, gating logic (credit requires active distributor).
- **Two-stage review** (spec compliance then code quality) on every integrity/security task, per the established subagent-driven flow.

## 8. Decision Log & Build Context

**Decisions locked:**
- Header + items with price *and* cost snapshot at line creation
- Effects on CONFIRM; `draft` = zero effects
- Three DB orchestration fns composing existing ledger write-paths (no bypass)
- Order status as idempotency key; all-or-nothing via existing CHECK constraints
- Customer always `shop_user`; distributor an optional credit overlay
- External orders created direct-confirmed (entry path only differs)
- Reuse `orders.read` / `orders.write`; no new permission keys
- No new ledger tables (orders are mutable state, not append-only)
- `fulfill` is status-only (no ledger effect); logistics deferred

**Build context:** Orders is the consumer that finally exercises Products' `record_stock_movement` and Distributors' `record_credit_movement` together. Builds on F0 + Products + Distributors (complete on local master): Next.js 16 App Router + Supabase + RLS + `withTenant` + `can()`/`requirePermission` + `AppShell` + Field Green tokens + the proven append-only-ledger / DB-function / anon-scoped-guard pattern + F0 `writeAudit`. Local Supabase DB port 54332 (never 54322). After user approval of this design **and** the static UI reference: writing-plans → subagent-driven build on master → finishing-a-development-branch. Never pushed — stays local per standing workflow rules.
