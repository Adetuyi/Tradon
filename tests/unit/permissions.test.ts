import { describe, it, expect } from 'vitest';
import { TENANT_ROLE_PERMS, PLATFORM_ROLE_PERMS } from '@/lib/rbac/permissions';

describe('role→permission maps', () => {
  it('Owner has dashboard.read; Viewer lacks finance.write', () => {
    expect(TENANT_ROLE_PERMS.Owner).toContain('dashboard.read');
    expect(TENANT_ROLE_PERMS.Viewer).not.toContain('finance.write');
  });
  it('all six tenant roles are seeded incl Field rep', () => {
    expect(Object.keys(TENANT_ROLE_PERMS).sort()).toEqual(
      ['Admin','Field rep','Finance','Owner','Sales','Viewer']);
  });
  it('platform namespace is separate', () => {
    expect(PLATFORM_ROLE_PERMS.Superadmin).toContain('platform.tenants.write');
    expect(TENANT_ROLE_PERMS.Owner).not.toContain('platform.tenants.write');
  });
});
