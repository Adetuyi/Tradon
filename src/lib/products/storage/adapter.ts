export interface StorageAdapter {
  putUrl(key: string, contentType: string): Promise<string>;
  publicUrl(key: string): string;
  deleteObject(key: string): Promise<void>;
}
const ALLOWED = new Set(['image/jpeg','image/png','image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;
export function validateImage(contentType: string, size: number):
  { ok: true } | { ok: false; error: string } {
  if (!ALLOWED.has(contentType)) return { ok:false, error:'unsupported image type' };
  if (size > MAX_BYTES) return { ok:false, error:'image exceeds 5MB' };
  return { ok:true };
}
export function buildKey(tenantId: string, productId: string, ext: string): string {
  return `tenants/${tenantId}/products/${productId}/${crypto.randomUUID()}.${ext}`;
}
