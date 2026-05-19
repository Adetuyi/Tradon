create or replace function confirm_order(p_order_id uuid, p_actor text)
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
  if v_status <> 'draft' then
    raise exception 'order is % (only draft can be confirmed)', v_status;
  end if;

  for r in
    select product_id, quantity, unit_cost
      from order_items where order_id = p_order_id and tenant_id = v_tenant
  loop
    perform record_stock_movement(
      r.product_id, 'sale', -r.quantity, r.unit_cost,
      'order ' || p_order_id, p_actor);
  end loop;

  if v_pay = 'credit' then
    if v_dist is null then
      raise exception 'credit order requires a distributor';
    end if;
    perform record_credit_movement(
      v_dist, 'purchase_draw', v_total, 'order ' || p_order_id, p_actor);
  end if;

  update orders set status = 'confirmed', updated_at = now()
    where id = p_order_id and tenant_id = v_tenant;
end $$;

grant execute on function confirm_order(uuid,text) to anon;
