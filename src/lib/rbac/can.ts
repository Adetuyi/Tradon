import { TENANT_ROLE_PERMS, PLATFORM_ROLE_PERMS } from './permissions';

export type Principal = { role: string; isPlatform: boolean } | null;

/**
 * Pure synchronous permission check — safe to call in any environment including
 * unit tests. Does NOT import next/navigation at module load time.
 */
export function can(p: Principal, permission: string): boolean {
  if (!p) return false;
  const map = p.isPlatform
    ? (PLATFORM_ROLE_PERMS as Record<string, readonly string[]>)
    : (TENANT_ROLE_PERMS as Record<string, readonly string[]>);
  return (map[p.role] ?? []).includes(permission);
}

/**
 * Server-only guard — redirects to /forbidden when the principal lacks the
 * required permission. Uses a dynamic import of next/navigation so that `can`
 * remains importable in vitest node env without pulling in Next.js internals
 * at module evaluation time.
 */
export async function requirePermission(p: Principal, permission: string): Promise<void> {
  if (!can(p, permission)) {
    const { redirect } = await import('next/navigation');
    redirect('/forbidden');
  }
}
