# Tradon — Local Dev

1. `pnpm install`
2. `pnpm dlx supabase start` (Docker required). This project uses non-default
   ports (DB **54332**, API 54331, Studio 54333) to avoid clashing with other
   local Supabase projects on this host — do not change them.
3. Copy `.env.local.example` → `.env.local`, fill keys from `supabase start`
   (DATABASE_URL must point at port 54332).
4. `pnpm dlx supabase db reset` to apply all migrations (0001..0011).
5. `pnpm test` — unit + integration (integration needs local Postgres up;
   Vitest loads `.env.local`; test files run serially via `fileParallelism:false`).
6. `pnpm build` to verify the Next.js app compiles.
7. `pnpm dev` — visit `http://chi.localhost:3000` after provisioning a tenant
   (subdomain resolution works on `*.localhost`).
8. `pnpm check:rls` — RLS guard; the build/CI must fail if any tenant-owned
   table lacks RLS + a `current_tenant_id()` policy.

## Invariants (do not break)
- Every tenant-owned table (any table with `tenant_id`) MUST have RLS enabled
  + a policy referencing `current_tenant_id()`; `pnpm check:rls` enforces this.
- Timestamps are UTC `timestamptz`.
- No raw hex in components — use the semantic Tailwind tokens (brand-spec.md).
- Destructive test helpers refuse to run unless DATABASE_URL is the 54332 DB.
- `audit_log` is append-only (UPDATE/DELETE no-op, TRUNCATE revoked from app roles).
