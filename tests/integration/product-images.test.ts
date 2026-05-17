import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createProduct, getProduct } from '@/lib/products/products';
import { requestImageUpload, attachImage } from '@/lib/products/images';
import { __resetStorage } from '@/lib/products/storage';

describe('product images', () => {
  it('presign -> attach sets image_key; re-attach replaces (prior deleted)', async () => {
    __resetStorage(); delete process.env.R2_BUCKET;
    await q(`delete from tenants where slug='pi-1'`);
    const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('I','pi-1') returning id`);
    const pid = await createProduct(t.id,{ sku:'IMG1',name:'x',sellingPrice:1,actor:'u' });
    const slot = await requestImageUpload(t.id, pid, 'image/jpeg', 1024);
    expect(slot.key).toMatch(new RegExp(`^tenants/${t.id}/products/${pid}/`));
    await attachImage(t.id, pid, slot.key);
    expect((await getProduct(t.id,pid))!.image_key).toBe(slot.key);
    const slot2 = await requestImageUpload(t.id, pid, 'image/png', 2048);
    await attachImage(t.id, pid, slot2.key);
    expect((await getProduct(t.id,pid))!.image_key).toBe(slot2.key);
  });
  it('rejects invalid image', async () => {
    await q(`delete from tenants where slug='pi-2'`);
    const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('I','pi-2') returning id`);
    const pid = await createProduct(t.id,{ sku:'IMG2',name:'x',sellingPrice:1,actor:'u' });
    await expect(requestImageUpload(t.id, pid, 'image/gif', 100)).rejects.toThrow();
  });
});
