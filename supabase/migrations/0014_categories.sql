create table categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  status text not null check (status in ('active','archived')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index categories_tenant_name_uniq on categories (tenant_id, lower(name));
create index categories_tenant_idx on categories (tenant_id);
alter table categories enable row level security;
create policy categories_iso on categories
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
grant select, insert, update on categories to anon;
