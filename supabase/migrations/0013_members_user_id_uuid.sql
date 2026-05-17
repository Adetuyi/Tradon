-- Revert the 0011 workaround: user_id must be uuid to match Supabase auth.users.id.
alter table tenant_members alter column user_id type uuid using user_id::uuid;
