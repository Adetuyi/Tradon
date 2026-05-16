import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseHost } from '@/lib/host';

export type TenantCtx = { id: string; slug: string; status: string };

export async function resolveTenant(rawHost: string): Promise<TenantCtx | null> {
  const info = parseHost(rawHost);
  let tenantId: string | null = null;

  if (info.kind === 'platform') return null;
  if (info.kind === 'custom') {
    const { data } = await supabaseAdmin.from('domains')
      .select('tenant_id').eq('host', info.host).maybeSingle();
    tenantId = data?.tenant_id ?? null;
  }
  const base = supabaseAdmin.from('tenants').select('id,slug,status');
  const { data } = info.kind === 'tenant'
    ? await base.eq('slug', info.slug).maybeSingle()
    : tenantId ? await base.eq('id', tenantId).maybeSingle()
    : { data: null };
  if (!data || data.status !== 'active') return null;
  return data as TenantCtx;
}
