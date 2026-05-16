alter table domains enable row level security;
create policy domains_iso on domains
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
-- Resolution reads domains BEFORE a tenant is known: use service-role client
-- (bypasses RLS) for host lookup only. App/tenant paths stay RLS-bound.
grant select on domains to anon;
