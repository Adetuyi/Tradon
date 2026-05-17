import { describe, it, expect } from 'vitest';
import { R2Storage } from '@/lib/products/storage/r2';

describe('R2Storage', () => {
  it('derives public URL from R2_PUBLIC_BASE_URL without network', () => {
    process.env.R2_ACCOUNT_ID='acc'; process.env.R2_ACCESS_KEY_ID='ak';
    process.env.R2_SECRET_ACCESS_KEY='sk'; process.env.R2_BUCKET='b';
    process.env.R2_PUBLIC_BASE_URL='https://cdn.example.com';
    const s = new R2Storage();
    expect(s.publicUrl('tenants/a/products/b/x.jpg'))
      .toBe('https://cdn.example.com/tenants/a/products/b/x.jpg');
  });
});
