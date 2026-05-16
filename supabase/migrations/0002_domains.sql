create table domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  host text not null unique,
  type text not null default 'subdomain' check (type in ('subdomain','custom')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index on domains (tenant_id);
