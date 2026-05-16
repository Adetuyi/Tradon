create table policy_acceptance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subject text not null,
  policy text not null,
  version text not null,
  accepted_at timestamptz not null default now()
);
create index on policy_acceptance (tenant_id, subject);
alter table policy_acceptance enable row level security;
create policy consent_iso on policy_acceptance
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
grant select, insert on policy_acceptance to anon;
