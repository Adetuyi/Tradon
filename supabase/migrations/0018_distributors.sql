create table distributors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  shop_user_id uuid not null references shop_users(id),
  business_name text not null,
  region text,
  address text,
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  outstanding numeric(14,2) not null default 0
    check (outstanding >= 0 and outstanding <= credit_limit),
  status text not null check (status in ('pending','active','suspended','archived'))
    default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, shop_user_id)
);
create index distributors_tenant_idx on distributors (tenant_id);
alter table distributors enable row level security;
create policy distributors_iso on distributors
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
grant select, insert, update on distributors to anon;
