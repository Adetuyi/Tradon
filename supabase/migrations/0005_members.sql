create table tenant_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid references tenants(id) on delete cascade,
  role text not null,
  is_platform boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);
create index on tenant_members (tenant_id);
alter table tenant_members enable row level security;
create policy tenant_members_iso on tenant_members
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
grant select, insert, update, delete on tenant_members to anon;
