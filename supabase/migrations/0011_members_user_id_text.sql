-- Change tenant_members.user_id from uuid to text so that provisioning
-- can accept any external auth provider user ID (not always a strict UUID).
alter table tenant_members alter column user_id type text using user_id::text;
