create table shop_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  password_hash text not null,
  full_name text not null,
  phone text,
  status text not null default 'customer' check (status in ('customer','distributor')),
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);
alter table shop_users enable row level security;
create policy shop_users_iso on shop_users
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
grant select, insert, update on shop_users to anon;
