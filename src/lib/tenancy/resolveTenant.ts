import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseHost } from '@/lib/host';
import { isPreviewMode, PREVIEW_DUMMY_TENANT } from '@/lib/preview';

export type TenantCtx = { id: string; slug: string; status: string };

/** TEMPORARY (preview mode): the first active tenant in the DB, or a
 *  synthetic dummy tenant when the DB has none yet. Never returns null,
 *  so preview-mode pages always have a tenant context to bind to and
 *  render their empty-state UI instead of 404'ing. See src/lib/preview.ts. */
async function previewTenant(): Promise<TenantCtx> {
  const { data } = await supabaseAdmin.from('tenants')
    .select('id,slug,status').eq('status', 'active')
    .order('created_at', { ascending: true }).limit(1).maybeSingle();
  return (data as TenantCtx) ?? PREVIEW_DUMMY_TENANT;
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
