create table products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sku text not null,
  name text not null,
  category_id uuid references categories(id),
  selling_price numeric(14,2) not null check (selling_price >= 0),
  cost_price numeric(14,2) not null default 0 check (cost_price >= 0),
  unit text not null default 'unit',
  reorder_threshold int not null default 0 check (reorder_threshold >= 0),
  current_quantity int not null default 0 check (current_quantity >= 0),
  status text not null check (status in ('active','archived')) default 'active',
  image_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_tenant_sku_uniq on products (tenant_id, sku);
create index products_tenant_idx on products (tenant_id);
alter table products enable row level security;
create policy products_iso on products
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
grant select, insert, update on products to anon;
