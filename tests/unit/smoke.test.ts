import { describe, it, expect } from 'vitest';
import { sum } from '@/lib/_smoke';

describe('toolchain', () => {
  it('runs typescript + alias', () => {
    expect(sum(2, 3)).toBe(5);
  });
});
