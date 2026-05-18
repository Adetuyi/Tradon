import { describe, it, expect } from 'vitest';
import { DISTRIBUTORS_READ, DISTRIBUTORS_WRITE }
  from '@/app/(tenant)/app/distributors/permissions';
describe('distributor permission keys', () => {
  it('reuses the F0 distributor permission keys', () => {
    expect(DISTRIBUTORS_READ).toBe('distributors.read');
    expect(DISTRIBUTORS_WRITE).toBe('distributors.write');
  });
});
