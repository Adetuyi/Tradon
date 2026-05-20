/**
 * ⚠️ TEMPORARY PREVIEW MODE — REMOVE BEFORE ANY REAL DEPLOYMENT ⚠️
 *
 * When the env var `TRADON_PREVIEW_MODE=1` is set, the auth / RBAC / tenant
 * gates are bypassed app-wide so anyone can view (and, since the RBAC gate is
 * shared with server actions, also mutate) the app without signing in.
 * Preview binds to the first (earliest-created) active tenant for data.
 *
 * Default OFF: with the env var unset/!= "1" behaviour is byte-for-byte
 * identical to before — no code path changes.
 *
 * To remove this feature entirely:
 *   1. Delete this file.
 *   2. Remove the three `isPreviewMode()` early-returns in:
 *        - src/lib/tenancy/resolveTenant.ts
 *        - src/lib/auth/staff.ts
 *        - src/lib/rbac/can.ts (requirePermission)
 *   3. Remove the preview banner block in src/app/layout.tsx.
 * Each call site is a single guarded early-return; nothing else depends on it.
 */
export function isPreviewMode(): boolean {
  return process.env.TRADON_PREVIEW_MODE === '1';
}

/** Synthetic staff identity used only while preview mode is on. */
export const PREVIEW_ACTOR = 'preview';
export const PREVIEW_EMAIL = 'preview@tradon.local';
export const PREVIEW_ROLE = 'Owner';

/**
 * Synthetic dummy tenant used by resolveTenant only when preview mode is on
 * AND the DB has no active tenant yet (e.g. a fresh cloud DB).
 *
 * The id is a UUID that does NOT exist in `tenants` — RLS-scoped queries
 * therefore return zero rows, so pages render their empty-state UI without
 * 404'ing. As soon as a real tenant is provisioned, `previewTenant()` picks
 * that real row over this dummy automatically.
 *
 * Mutations (form submits, server actions) against the dummy will fail with
 * FK errors at the DB layer — that is intentional: preview lets visitors
 * SEE the UI, not corrupt data into a non-existent tenant.
 */
export const PREVIEW_DUMMY_TENANT = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'preview',
  status: 'active',
} as const;