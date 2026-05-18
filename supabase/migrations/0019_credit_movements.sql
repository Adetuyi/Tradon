create table credit_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  distributor_id uuid not null references distributors(id),
  type text not null check (type in ('purchase_draw','repayment','adjustment')),
  delta numeric(14,2) not null check (delta <> 0),
  reason text,
  actor text not null,
  created_at timestamptz not null default now()
);
create index credit_movements_tdc_idx on credit_movements (tenant_id, distributor_id, created_at);
alter table credit_movements enable row level security;
create policy credit_movements_iso on credit_movements
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
revoke update, delete on credit_movements from anon, authenticated;
grant select, insert on credit_movements to anon;
create rule credit_movements_no_update as on update to credit_movements do instead nothing;
create rule credit_movements_no_delete as on delete to credit_movements do instead nothing;
revoke truncate on credit_movements from anon, authenticated, service_role;
