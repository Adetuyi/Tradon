import { supabaseAdmin } from '@/lib/supabase/admin';
import { writeAudit } from '@/lib/compliance/audit';

export async function provisionTenant(input: {
  name: string; slug: string; ownerUserId: string;
  region: string; currency: string;
}): Promise<{ tenantId: string }> {
  const { data: t, error } = await supabaseAdmin.from('tenants')
    .insert({ name: input.name, slug: input.slug,
      region: input.region, currency: input.currency })
    .select('id').single();
  if (error || !t) throw new Error(error?.message ?? 'tenant insert failed');

  await supabaseAdmin.from('domains').insert({
    tenant_id: t.id, host: `${input.slug}.tradon.app`, type: 'subdomain' });
  await supabaseAdmin.from('tenant_members').insert({
    user_id: input.ownerUserId, tenant_id: t.id, role: 'Owner' });
  await writeAudit({ tenantId: t.id, actor: input.ownerUserId,
    action: 'tenant.provisioned', target: t.id, meta: { slug: input.slug } });
  return { tenantId: t.id };
}
