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
  await requirePermission(
    session.membership ? { role: session.membership.role, isPlatform: false } : null,
    'dashboard.read',
  );
  return <main className="p-10 font-display text-ink">Foundation ready.</main>;
}
