import { describe, it, expect } from 'vitest';
import { PRODUCTS_READ, PRODUCTS_WRITE } from '@/app/(tenant)/app/products/actions';
describe('products action permission keys', () => {
  it('uses the F0 product permission keys', () => {
    expect(PRODUCTS_READ).toBe('products.read');
    expect(PRODUCTS_WRITE).toBe('products.write');
  });
});
