import { describe, it, expect } from 'vitest';
import { can } from '@/lib/rbac/can';

describe('can()', () => {
  it('resolves tenant-namespace permissions by role', () => {
    expect(can({ role: 'Finance', isPlatform: false }, 'finance.write')).toBe(true);
    expect(can({ role: 'Sales', isPlatform: false }, 'finance.write')).toBe(false);
  });
  it('resolves platform namespace separately', () => {
    expect(can({ role: 'Superadmin', isPlatform: true }, 'platform.tenants.write')).toBe(true);
    expect(can({ role: 'Owner', isPlatform: false }, 'platform.tenants.write')).toBe(false);
  });
  it('null membership denies everything', () => {
    expect(can(null, 'dashboard.read')).toBe(false);
  });
});
