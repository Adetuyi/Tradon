import { withTenant } from '@/lib/db/withTenant';

export async function recordConsent(e: {
  tenantId: string; subject: string; policy: string; version: string;
}) {
  await withTenant(e.tenantId, (c) => c.query(
    `insert into policy_acceptance(tenant_id,subject,policy,version)
     values(current_tenant_id(),$1,$2,$3)`,
    [e.subject, e.policy, e.version]));
}
