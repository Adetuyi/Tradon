create extension if not exists pgcrypto;

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','inactive')),
  region text not null default 'NG',
  currency text not null default 'NGN',
  locale text not null default 'en-NG',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
