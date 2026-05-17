-- tenants is the cross-tenant registry. The shared `anon` role used by
-- withTenant() must never read or mutate it; registry access is service-role
-- only (resolveTenant/provisionTenant use supabaseAdmin, which bypasses this).
revoke select, insert, update, delete, truncate on tenants from anon, authenticated;
