create or replace function record_credit_movement(
  p_distributor_id uuid, p_type text, p_delta numeric,
  p_reason text, p_actor text)
returns void language plpgsql security definer
set search_path = public as $$
declare v_tenant uuid := current_tenant_id(); v_status text;
begin
  if v_tenant is null then raise exception 'no tenant context'; end if;
  select status into v_status from distributors
    where id = p_distributor_id and tenant_id = v_tenant;
  if not found then raise exception 'distributor not found'; end if;
  if p_type = 'purchase_draw' and v_status <> 'active' then
    raise exception 'distributor must be active for a purchase draw (is %)', v_status;
  end if;
  if v_status = 'archived' then raise exception 'distributor is archived'; end if;

  perform set_config('app.allow_credit_movement','1', true);
  insert into credit_movements(tenant_id,distributor_id,type,delta,reason,actor)
    values (v_tenant,p_distributor_id,p_type,p_delta,p_reason,p_actor);
  perform set_config('app.allow_credit_movement','', true);

  update distributors set outstanding = outstanding + p_delta, updated_at = now()
    where id = p_distributor_id and tenant_id = v_tenant;
end $$;

create or replace function credit_movements_guard() returns trigger
language plpgsql as $$
begin
  if current_user = 'anon'
     and coalesce(current_setting('app.allow_credit_movement', true),'') <> '1' then
    raise exception 'credit_movements may only be written via record_credit_movement';
  end if;
  return new;
end $$;

create trigger credit_movements_guard_trg
  before insert on credit_movements
  for each row execute function credit_movements_guard();

grant execute on function record_credit_movement(uuid,text,numeric,text,text) to anon;
