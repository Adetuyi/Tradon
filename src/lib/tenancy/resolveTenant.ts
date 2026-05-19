import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseHost } from '@/lib/host';
import { isPreviewMode } from '@/lib/preview';

export type TenantCtx = { id: string; slug: string; status: string };

/** TEMPORARY (preview mode): first active tenant, used when no tenant
 *  could be resolved from the host. See src/lib/preview.ts. */
async function previewTenant(): Promise<TenantCtx | null> {
  const { data } = await supabaseAdmin.from('tenants')
    .select('id,slug,status').eq('status', 'active')
    .order('created_at', { ascending: true }).limit(1).maybeSingle();
  return (data as TenantCtx) ?? null;
}

export async function resolveTenant(rawHost: string): Promise<TenantCtx | null> {
  const info = parseHost(rawHost);
  let tenantId: string | null = null;

  if (info.kind === 'platform') return isPreviewMode() ? previewTenant() : null;
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
  if (!data || data.status !== 'active') {
    return isPreviewMode() ? previewTenant() : null;
  }
  return data as TenantCtx;
}
