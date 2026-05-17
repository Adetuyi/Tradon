'use server';
import { revalidatePath } from 'next/cache';
import { provisionTenant } from '@/lib/provisioning/provisionTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';

export async function createTenant(fd: FormData) {
  const session = await getStaffSession(null);
  const principal = session?.membership?.isPlatform
    ? { role: session.membership.role, isPlatform: true } : null;
  await requirePermission(principal, 'platform.tenants.write');
  await provisionTenant({
    name: String(fd.get('name')), slug: String(fd.get('slug')),
    ownerUserId: String(fd.get('owner_user_id')),
    region: 'NG', currency: 'NGN' });
  revalidatePath('/admin/tenants');
}
