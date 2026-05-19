import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isPreviewMode, PREVIEW_ACTOR, PREVIEW_EMAIL, PREVIEW_ROLE } from '@/lib/preview';

export type StaffSession = {
  userId: string; email: string;
  membership: { tenantId: string | null; role: string; isPlatform: boolean } | null;
};

export async function getStaffSession(tenantId: string | null): Promise<StaffSession | null> {
  // TEMPORARY (preview mode): synthetic Owner session, no real login.
  // See src/lib/preview.ts.
  if (isPreviewMode()) {
    return {
      userId: PREVIEW_ACTOR, email: PREVIEW_EMAIL,
      membership: { tenantId, role: PREVIEW_ROLE, isPlatform: false },
    };
  }
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await supabaseAdmin.from('tenant_members')
    .select('tenant_id,role,is_platform')
    .eq('user_id', user.id);
  const m = (data ?? []).find(r =>
    tenantId ? r.tenant_id === tenantId : r.is_platform) ?? null;
  return {
    userId: user.id, email: user.email!,
    membership: m ? { tenantId: m.tenant_id, role: m.role, isPlatform: m.is_platform } : null,
  };
}
