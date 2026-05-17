create or replace function record_stock_movement(
  p_product_id uuid, p_type text, p_qty_delta int,
  p_unit_cost numeric, p_reason text, p_actor text)
returns void language plpgsql security definer
set search_path = public as $$
declare v_tenant uuid := current_tenant_id();
begin
  if v_tenant is null then raise exception 'no tenant context'; end if;
  perform 1 from products
    where id = p_product_id and tenant_id = v_tenant and status = 'active';
  if not found then raise exception 'product not found or archived'; end if;

  perform set_config('app.allow_stock_movement','1', true);
  insert into stock_movements(tenant_id,product_id,type,qty_delta,unit_cost,reason,actor)
    values (v_tenant,p_product_id,p_type,p_qty_delta,p_unit_cost,p_reason,p_actor);
  perform set_config('app.allow_stock_movement','', true);

  update products set current_quantity = current_quantity + p_qty_delta,
                      updated_at = now()
    where id = p_product_id and tenant_id = v_tenant;
end $$;

create or replace function stock_movements_guard() returns trigger
language plpgsql as $$
begin
  -- Only enforce the guard for the anon role (application-layer writes).
  -- Direct postgres/admin writes (e.g. migrations, seeding) are allowed through.
  if current_user = 'anon' and
     coalesce(current_setting('app.allow_stock_movement', true),'') <> '1' then
    raise exception 'stock_movements may only be written via record_stock_movement';
  end if;
  return new;
end $$;

create trigger stock_movements_guard_trg
  before insert on stock_movements
  for each row execute function stock_movements_guard();

grant execute on function record_stock_movement(uuid,text,int,numeric,text,text) to anon;
