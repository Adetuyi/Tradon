export type TenantRole = 'Owner'|'Admin'|'Finance'|'Sales'|'Field rep'|'Viewer';
export type PlatformRole = 'Superadmin';

const ALL_TENANT = [
  'dashboard.read','distributors.read','distributors.write',
  'products.read','products.write','orders.read','orders.write',
  'finance.read','finance.write','reporting.read',
  'users.read','users.write','settings.read','settings.write',
] as const;

export const TENANT_ROLE_PERMS: Record<TenantRole, readonly string[]> = {
  Owner: ALL_TENANT,
  Admin: ALL_TENANT.filter(p => p !== 'finance.write'),
  Finance: ['dashboard.read','finance.read','finance.write','reporting.read'],
  Sales: ['dashboard.read','distributors.read','orders.read','orders.write'],
  'Field rep': ['dashboard.read','distributors.read'],
  Viewer: ALL_TENANT.filter(p => p.endsWith('.read')),
};

export const PLATFORM_ROLE_PERMS: Record<PlatformRole, readonly string[]> = {
  Superadmin: ['platform.tenants.read','platform.tenants.write',
    'platform.domains.read','platform.audit.read'],
};
