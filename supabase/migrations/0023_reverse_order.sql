create or replace function _reverse_order(
  p_order_id uuid, p_actor text, p_new_status text)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_tenant uuid := current_tenant_id();
  v_status text; v_pay text; v_dist uuid; v_total numeric;
  r record;
begin
  if v_tenant is null then raise exception 'no tenant context'; end if;

  select status, payment_method, distributor_id, total
    into v_status, v_pay, v_dist, v_total
    from orders where id = p_order_id and tenant_id = v_tenant;
  if not found then raise exception 'order not found'; end if;
  if v_status not in ('confirmed','fulfilled') then
    raise exception 'order is % (only confirmed/fulfilled can be reversed)', v_status;
  end if;

  for r in
    select product_id, quantity, unit_cost
      from order_items where order_id = p_order_id and tenant_id = v_tenant
  loop
    perform record_stock_movement(
      r.product_id, 'return', r.quantity, r.unit_cost,
      'order ' || p_new_status || ' ' || p_order_id, p_actor);
  end loop;

  if v_pay = 'credit' and v_dist is not null then
    perform record_credit_movement(
      v_dist, 'adjustment', -v_total,
      'order ' || p_new_status || ' ' || p_order_id, p_actor);
  end if;

  update orders set status = p_new_status, updated_at = now()
    where id = p_order_id and tenant_id = v_tenant;
end $$;

create or replace function cancel_order(p_order_id uuid, p_actor text)
returns void language plpgsql security definer
set search_path = public as $$
begin perform _reverse_order(p_order_id, p_actor, 'cancelled'); end $$;

create or replace function return_order(p_order_id uuid, p_actor text)
returns void language plpgsql security definer
set search_path = public as $$
begin perform _reverse_order(p_order_id, p_actor, 'returned'); end $$;

grant execute on function cancel_order(uuid,text) to anon;
grant execute on function return_order(uuid,text) to anon;
