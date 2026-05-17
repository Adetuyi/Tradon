import { withTenant } from '@/lib/db/withTenant';
import { getStorage } from './storage';
import { validateImage, buildKey } from './storage/adapter';
import { getProduct } from './products';

const EXT: Record<string,string> = { 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' };

export async function requestImageUpload(tenantId: string, productId: string,
  contentType: string, size: number): Promise<{ key: string; url: string }> {
  const v = validateImage(contentType, size);
  if (!v.ok) throw new Error(v.error);
  const key = buildKey(tenantId, productId, EXT[contentType]);
  const url = await getStorage().putUrl(key, contentType);
  return { key, url };
}

export async function attachImage(tenantId: string, productId: string, key: string) {
  const prev = (await getProduct(tenantId, productId))?.image_key ?? null;
  await withTenant(tenantId, c => c.query(
    `update products set image_key=$2, updated_at=now() where id=$1`, [productId, key]));
  if (prev && prev !== key) await getStorage().deleteObject(prev);
}
