'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { getStaffSession } from '@/lib/auth/staff';
import { requirePermission } from '@/lib/rbac/can';
import { createProduct, updateProduct, archiveProduct } from '@/lib/products/products';
import { recordStockMovement, listMovements, MovementType } from '@/lib/products/stock';
import { requestImageUpload, attachImage } from '@/lib/products/images';
import { revalidatePath } from 'next/cache';
import { PRODUCTS_READ, PRODUCTS_WRITE } from './permissions';
export { PRODUCTS_READ, PRODUCTS_WRITE };

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

export async function createProductAction(fd: FormData) {
  const { tenantId, actor } = await gate(PRODUCTS_WRITE);
  await createProduct(tenantId, {
    sku:String(fd.get('sku')), name:String(fd.get('name')),
    categoryId:(fd.get('categoryId') as string) || null,
    sellingPrice:Number(fd.get('sellingPrice')), costPrice:Number(fd.get('costPrice')||0),
    unit:String(fd.get('unit')||'unit'), reorderThreshold:Number(fd.get('reorderThreshold')||0),
    openingQuantity:Number(fd.get('openingQuantity')||0),
    imageKey:(fd.get('imageKey') as string) || null, actor });
  revalidatePath('/app/products');
}
export async function updateProductAction(fd: FormData) {
  const { tenantId } = await gate(PRODUCTS_WRITE);
  await updateProduct(tenantId, String(fd.get('id')), {
    name:String(fd.get('name')), sellingPrice:Number(fd.get('sellingPrice')),
    costPrice:Number(fd.get('costPrice')), unit:String(fd.get('unit')),
    reorderThreshold:Number(fd.get('reorderThreshold')),
    categoryId:(fd.get('categoryId') as string) || null });
  revalidatePath('/app/products');
}
export async function archiveProductAction(fd: FormData) {
  const { tenantId } = await gate(PRODUCTS_WRITE);
  await archiveProduct(tenantId, String(fd.get('id')));
  revalidatePath('/app/products');
}
export async function adjustStockAction(fd: FormData) {
  const { tenantId, actor } = await gate(PRODUCTS_WRITE);
  const type = String(fd.get('type')) as MovementType;
  const reason = String(fd.get('reason') || '');
  if (type === 'adjustment' && !reason.trim()) throw new Error('reason required for adjustment');
  const mag = Math.abs(Number(fd.get('qty')));
  if (!mag || Number.isNaN(mag)) throw new Error('quantity required');
  const qtyDelta = String(fd.get('direction')) === 'subtract' ? -mag : mag;
  await recordStockMovement(tenantId, { productId: String(fd.get('productId')),
    type, qtyDelta, unitCost: fd.get('unitCost') ? Number(fd.get('unitCost')) : null,
    reason: reason || null, actor });
  revalidatePath('/app/products');
}

export async function recentMovementsAction(productId: string) {
  const { tenantId } = await gate(PRODUCTS_READ);
  return listMovements(tenantId, productId);
}
export async function requestImageUploadAction(productId: string,
  contentType: string, size: number) {
  const { tenantId } = await gate(PRODUCTS_WRITE);
  return requestImageUpload(tenantId, productId, contentType, size);
}
export async function attachImageAction(productId: string, key: string) {
  const { tenantId } = await gate(PRODUCTS_WRITE);
  await attachImage(tenantId, productId, key);
  revalidatePath('/app/products');
}
