'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { ORDERS_WRITE } from './permissions';
import { createOrder, OrderChannel, PaymentMethod, OrderLineInput }
  from '@/lib/orders/orders';
import { confirmOrder, cancelOrder, returnOrder, fulfillOrder }
  from '@/lib/orders/lifecycle';

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

export async function createOrderAction(fd: FormData) {
  const { tenantId, actor } = await gate(ORDERS_WRITE);
  const lines = JSON.parse(String(fd.get('lines') || '[]')) as OrderLineInput[];
  const channel = String(fd.get('channel')) as OrderChannel;
  const distributorId = (fd.get('distributorId') as string) || null;
  await createOrder(tenantId, {
    shopUserId: String(fd.get('shopUserId')),
    distributorId,
    channel,
    paymentMethod: String(fd.get('paymentMethod')) as PaymentMethod,
    lines,
    actor,
    confirmNow: channel === 'external',
  });
  revalidatePath('/app/orders');
}

export async function confirmOrderAction(fd: FormData) {
  const { tenantId, actor } = await gate(ORDERS_WRITE);
  await confirmOrder(tenantId, String(fd.get('id')), actor);
  revalidatePath(`/app/orders/${fd.get('id')}`);
}
export async function fulfillOrderAction(fd: FormData) {
  const { tenantId, actor } = await gate(ORDERS_WRITE);
  await fulfillOrder(tenantId, String(fd.get('id')), actor);
  revalidatePath(`/app/orders/${fd.get('id')}`);
}
export async function cancelOrderAction(fd: FormData) {
  const { tenantId, actor } = await gate(ORDERS_WRITE);
  await cancelOrder(tenantId, String(fd.get('id')), actor);
  revalidatePath(`/app/orders/${fd.get('id')}`);
}
export async function returnOrderAction(fd: FormData) {
  const { tenantId, actor } = await gate(ORDERS_WRITE);
  await returnOrder(tenantId, String(fd.get('id')), actor);
  revalidatePath(`/app/orders/${fd.get('id')}`);
}
