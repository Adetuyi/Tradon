# Tradon

Tradon is a multi-tenant **Distribution Management System** for FMCGs and any
other industry that finds it beneficial. Every business/client gets their own
domain (e.g. `chi.tradon.app`), with the option of a custom domain later.

## Vision

### Tenant back-office
- **Dashboard** — orders, revenue, overdue distributors, revenue trend, low
  stock, top products, regional profitability, AI brief, etc. (see
  `dashboard-screenshot.png`).
- **Distributors** — table + detail views; manage distributor credits used to
  purchase on the tenant's retailer platform.
- **Products** — stat cards (total products, low stock, inventory value),
  inventory table + management (create/edit/stock). Promos/variants
  (buy 5 get 1 free, buy 100 get 1% off, buy 1000 get ₦100 credit), delivery
  fee customization.
- **Orders** — processed orders; external orders can be logged/filed in.
- **Finance** — overdue/credits out, profit out, amount made on/off platform,
  top distributors with credit.
- **Reporting** — by region, SKU, distributor, etc.
- **Billing & Pricing** — Tradon → tenant (pricing model TBD, own brainstorm).
- **Users & Permissions** — onboard users by role, manage roles/users.
- **Settings** — delivery areas and fees, etc.
- **Profile** — per logged-in user.

### Public retailer shop (`/shop`, optional custom domain)
Product listing, cart, end-user auth, orders, profile, account, wallet
(system credits from failed/cancelled purchases + payout requests). Regular
users can apply to become a **distributor**, approved by the tenant. A credit
page shows tenant-granted credits.

### Platform
- Admin platform
- Landing screen

> Much of this is initial structure and ideas, not final. Pricing methods are
> undecided and will be brainstormed. We are not limited to the above.

## Status

Greenfield. Architecture and the first sub-project (Platform Foundation) have
been brainstormed — see `docs/superpowers/specs/`.
