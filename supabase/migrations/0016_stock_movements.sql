create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  product_id uuid not null,
  type text not null check (type in ('receipt','adjustment','sale','return')),
  qty_delta int not null check (qty_delta <> 0),
  unit_cost numeric(14,2),
  reason text,
  actor text not null,
  created_at timestamptz not null default now()
);
create index stock_movements_tpc_idx on stock_movements (tenant_id, product_id, created_at);
alter table stock_movements enable row level security;
create policy stock_movements_iso on stock_movements
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
revoke update, delete on stock_movements from anon, authenticated;
grant select, insert on stock_movements to anon;
create rule stock_movements_no_update as on update to stock_movements do instead nothing;
create rule stock_movements_no_delete as on delete to stock_movements do instead nothing;
revoke truncate on stock_movements from anon, authenticated, service_role;
