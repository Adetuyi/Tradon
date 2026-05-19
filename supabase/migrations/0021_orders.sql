create table orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  shop_user_id uuid not null references shop_users(id),
  distributor_id uuid references distributors(id),
  channel text not null check (channel in ('platform','external')) default 'platform',
  payment_method text not null check (payment_method in ('paid','credit')) default 'paid',
  status text not null
    check (status in ('draft','confirmed','fulfilled','cancelled','returned'))
    default 'draft',
  total numeric(14,2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_tenant_created_idx on orders (tenant_id, created_at desc);
alter table orders enable row level security;
create policy orders_iso on orders
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
grant select, insert, update on orders to anon;

create table order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity int not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on order_items (order_id);
create index order_items_tenant_idx on order_items (tenant_id);
alter table order_items enable row level security;
create policy order_items_iso on order_items
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
grant select, insert, update, delete on order_items to anon;
