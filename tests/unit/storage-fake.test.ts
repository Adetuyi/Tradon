import { describe, it, expect } from 'vitest';
import { FakeStorage } from '@/lib/products/storage/fake';
import { validateImage, buildKey } from '@/lib/products/storage/adapter';
import { getStorage, __resetStorage } from '@/lib/products/storage';

describe('storage adapter', () => {
  it('fake put/url/delete + key convention', async () => {
    const s = new FakeStorage();
    const key = buildKey('ten1','prod1','jpg');
    expect(key.startsWith('tenants/ten1/products/prod1/')).toBe(true);
    expect(key.endsWith('.jpg')).toBe(true);
    const put = await s.putUrl(key,'image/jpeg');
    expect(put).toContain(key);
    await s.markUploaded(key, Buffer.from('x'));
    expect(s.publicUrl(key)).toContain(key);
    await s.deleteObject(key);
    expect(s.has(key)).toBe(false);
  });
  it('validateImage rejects bad type and oversize', () => {
    expect(validateImage('image/gif', 100).ok).toBe(false);
    expect(validateImage('image/png', 6*1024*1024).ok).toBe(false);
    expect(validateImage('image/webp', 1024).ok).toBe(true);
  });
  it('provider falls back to fake when R2 env absent', () => {
    __resetStorage();
    delete process.env.R2_BUCKET; delete process.env.R2_ACCOUNT_ID;
    expect(getStorage().constructor.name).toBe('FakeStorage');
  });
});
