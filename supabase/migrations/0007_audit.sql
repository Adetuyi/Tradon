create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor text not null,
  action text not null,
  target text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on audit_log (tenant_id, created_at);
alter table audit_log enable row level security;
create policy audit_iso on audit_log
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
revoke update, delete on audit_log from anon, authenticated;
grant select, insert on audit_log to anon;
create rule audit_no_update as on update to audit_log do instead nothing;
create rule audit_no_delete as on delete to audit_log do instead nothing;
