import { withTenant } from '@/lib/db/withTenant';

export async function writeAudit(e: {
  tenantId: string; actor: string; action: string;
  target?: string; meta?: Record<string, unknown>;
}) {
  await withTenant(e.tenantId, (c) => c.query(
    `insert into audit_log(tenant_id,actor,action,target,meta)
     values(current_tenant_id(),$1,$2,$3,$4)`,
    [e.actor, e.action, e.target ?? null, JSON.stringify(e.meta ?? {})]));
}
