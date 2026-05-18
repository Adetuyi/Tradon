'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { DISTRIBUTORS_READ, DISTRIBUTORS_WRITE } from './permissions';
import { createDistributor, updateDistributor, setStatus, setCreditLimit }
  from '@/lib/distributors/distributors';
import { recordCreditMovement, CreditType } from '@/lib/distributors/credit';

async function gate(perm: string) {
  const tenant = await resolveTenant((await headers()).get('host') ?? '');
  if (!tenant) redirect('/not-found-tenant');
  const session = await getStaffSession(tenant.id);
  if (!session) redirect('/login');
  const principal = session.membership
    ? { role: session.membership.role, isPlatform: false } : null;
  await requirePermission(principal, perm);
  return { tenantId: tenant.id, actor: session.userId };
}

export async function createDistributorAction(fd: FormData) {
  const { tenantId } = await gate(DISTRIBUTORS_WRITE);
  const shopUserId = (fd.get('shopUserId') as string) || undefined;
  await createDistributor(tenantId, shopUserId
    ? { shopUserId, businessName:String(fd.get('businessName')),
        region:(fd.get('region') as string)||null,
        creditLimit:Number(fd.get('creditLimit')||0) }
    : { businessName:String(fd.get('businessName')),
        email:String(fd.get('email')), contactName:String(fd.get('contactName')),
        region:(fd.get('region') as string)||null,
        creditLimit:Number(fd.get('creditLimit')||0) });
  revalidatePath('/app/distributors');
}
export async function updateDistributorAction(fd: FormData) {
  const { tenantId } = await gate(DISTRIBUTORS_WRITE);
  await updateDistributor(tenantId, String(fd.get('id')), {
    businessName:String(fd.get('businessName')),
    region:(fd.get('region') as string)||null,
    address:(fd.get('address') as string)||null });
  revalidatePath(`/app/distributors/${fd.get('id')}`);
}
export async function setStatusAction(fd: FormData) {
  const { tenantId, actor } = await gate(DISTRIBUTORS_WRITE);
  await setStatus(tenantId, String(fd.get('id')),
    String(fd.get('status')) as 'active'|'suspended'|'archived', actor);
  revalidatePath('/app/distributors');
}
export async function setCreditLimitAction(fd: FormData) {
  const { tenantId, actor } = await gate(DISTRIBUTORS_WRITE);
  await setCreditLimit(tenantId, String(fd.get('id')),
    Number(fd.get('creditLimit')), actor);
  revalidatePath(`/app/distributors/${fd.get('id')}`);
}
export async function recordCreditAction(fd: FormData) {
  const { tenantId, actor } = await gate(DISTRIBUTORS_WRITE);
  const type = String(fd.get('type')) as CreditType;
  const mag = Math.abs(Number(fd.get('amount')));
  if (!mag || Number.isNaN(mag)) throw new Error('amount required');
  if (type === 'purchase_draw') throw new Error('purchase draws come from Orders, not here');
  const reason = String(fd.get('reason') || '');
  const delta = type === 'repayment' ? -mag
    : (String(fd.get('direction')) === 'subtract' ? -mag : mag);
  await recordCreditMovement(tenantId, { distributorId:String(fd.get('id')),
    type, delta, reason: reason || null, actor });
  revalidatePath(`/app/distributors/${fd.get('id')}`);
}
