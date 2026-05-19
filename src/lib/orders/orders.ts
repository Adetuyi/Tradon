import { withTenant } from '@/lib/db/withTenant';

export type OrderChannel = 'platform' | 'external';
export type PaymentMethod = 'paid' | 'credit';
export type OrderStatus =
  'draft' | 'confirmed' | 'fulfilled' | 'cancelled' | 'returned';

export type OrderLineInput = {
  productId: string; quantity: number; unitPrice: number; unitCost: number;
};
export type CreateOrderInput = {
  shopUserId: string;
  distributorId?: string | null;
  channel: OrderChannel;
  paymentMethod: PaymentMethod;
  lines: OrderLineInput[];
  actor: string;
  confirmNow?: boolean;
};
export type Order = {
  id: string; shop_user_id: string; distributor_id: string | null;
  channel: string; payment_method: string; status: string; total: string;
  created_at: string; updated_at: string;
};
export type OrderItem = {
  id: string; product_id: string; quantity: number;
  unit_price: string; unit_cost: string; line_total: string;
};

export async function createOrder(
  tenantId: string, i: CreateOrderInput): Promise<string> {
  if (i.lines.length === 0) throw new Error('order needs at least one line');
  if (i.paymentMethod === 'credit' && !i.distributorId) {
    throw new Error('credit orders require a distributor');
  }
  return withTenant(tenantId, async c => {
    const total = i.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const id = (await c.query(
      `insert into orders(tenant_id,shop_user_id,distributor_id,channel,
         payment_method,status,total)
       values(current_tenant_id(),$1,$2,$3,$4,'draft',$5) returning id`,
      [i.shopUserId, i.distributorId ?? null, i.channel,
       i.paymentMethod, total])).rows[0].id as string;
    for (const l of i.lines) {
      await c.query(
        `insert into order_items(tenant_id,order_id,product_id,quantity,
           unit_price,unit_cost,line_total)
         values(current_tenant_id(),$1,$2,$3,$4,$5,$6)`,
        [id, l.productId, l.quantity, l.unitPrice, l.unitCost,
         l.quantity * l.unitPrice]);
    }
    if (i.confirmNow) {
      await c.query(`select confirm_order($1,$2)`, [id, i.actor]);
    }
    return id;
  });
}

export async function getOrder(
  tenantId: string, id: string): Promise<Order | null> {
  return withTenant(tenantId, async c => (await c.query(
    `select id,shop_user_id,distributor_id,channel,payment_method,status,
       total,created_at,updated_at from orders where id=$1`,
    [id])).rows[0] ?? null);
}

export async function listOrderItems(
  tenantId: string, orderId: string): Promise<OrderItem[]> {
  return withTenant(tenantId, async c => (await c.query(
    `select id,product_id,quantity,unit_price,unit_cost,line_total
     from order_items where order_id=$1 order by created_at`,
    [orderId])).rows);
}

export async function listOrders(tenantId: string,
  f: { search?: string; status?: string; channel?: string }):
  Promise<(Order & { customer: string })[]> {
  return withTenant(tenantId, async c => {
    const w: string[] = []; const v: unknown[] = []; let n = 1;
    if (f.status) { w.push(`o.status=$${n++}`); v.push(f.status); }
    if (f.channel) { w.push(`o.channel=$${n++}`); v.push(f.channel); }
    if (f.search) {
      w.push(`(su.full_name ilike $${n} or o.id::text ilike $${n})`);
      v.push(`%${f.search}%`); n++;
    }
    return (await c.query(
      `select o.id,o.shop_user_id,o.distributor_id,o.channel,o.payment_method,
              o.status,o.total,o.created_at,o.updated_at,
              su.full_name as customer
       from orders o join shop_users su on su.id=o.shop_user_id
       ${w.length ? `where ${w.join(' and ')}` : ''}
       order by o.created_at desc`, v)).rows;
  });
}
