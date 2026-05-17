'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { createCategory, renameCategory, archiveCategory } from '@/lib/products/categories';
import { revalidatePath } from 'next/cache';

async function gateWrite() {
  const tenant = await resolveTenant((await headers()).get('host') ?? '');
  if (!tenant) redirect('/not-found-tenant');
  const session = await getStaffSession(tenant.id);
  if (!session) redirect('/login');
  const principal = session.membership
    ? { role: session.membership.role, isPlatform: false } : null;
  await requirePermission(principal, 'products.write');
  return tenant.id;
}
export async function createCategoryAction(fd: FormData) {
  const t = await gateWrite();
  await createCategory(t, String(fd.get('name'))); revalidatePath('/app/products/categories');
}
export async function renameCategoryAction(fd: FormData) {
  const t = await gateWrite();
  await renameCategory(t, String(fd.get('id')), String(fd.get('name')));
  revalidatePath('/app/products/categories');
}
export async function archiveCategoryAction(fd: FormData) {
  const t = await gateWrite();
  await archiveCategory(t, String(fd.get('id'))); revalidatePath('/app/products/categories');
}
