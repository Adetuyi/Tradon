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
