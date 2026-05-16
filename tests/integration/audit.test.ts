import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { writeAudit } from '@/lib/compliance/audit';

describe('audit log', () => {
  it('records who/what/when and is append-only (update is a no-op)', async () => {
    await q(`delete from tenants where slug='aud-t'`);
    const [t] = await q<{id:string}>(`insert into tenants(name,slug)
      values('Aud','aud-t') returning id`);
    await writeAudit({ tenantId: t.id, actor: 'u1', action: 'tenant.provisioned',
      target: t.id, meta: { slug: 'aud-t' } });
    const rows = await q(`select action, actor from audit_log where tenant_id=$1`, [t.id]);
    expect(rows[0]).toMatchObject({ action: 'tenant.provisioned', actor: 'u1' });
    // append-only: UPDATE must not mutate the row (rule = do instead nothing)
    await q(`update audit_log set action='tampered' where tenant_id=$1`, [t.id]);
    const after = await q(`select action from audit_log where tenant_id=$1`, [t.id]);
    expect(after[0].action).toBe('tenant.provisioned');
    // append-only: DELETE must not remove the row
    await q(`delete from audit_log where tenant_id=$1`, [t.id]);
    const stillThere = await q(`select count(*)::int n from audit_log where tenant_id=$1`, [t.id]);
    expect(stillThere[0].n).toBe(1);
  });
});
