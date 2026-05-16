import { describe, it, expect, beforeAll } from 'vitest';
import { q } from '../helpers/db';
import { registerShopUser } from '@/lib/auth/shop';
import { exportUserData, eraseUserData } from '@/lib/compliance/pii';

let tid: string;
beforeAll(async () => {
  await q(`delete from tenants where slug='pii-t'`);
  [{ id: tid }] = await q<{id:string}>(`insert into tenants(name,slug)
    values('Pii','pii-t') returning id`);
});

describe('PII operations', () => {
  it('exports then hard-erases a shop user', async () => {
    const uid = await registerShopUser(tid, 'erase@example.com', 'pw1', 'Erase Me');
    const dump = await exportUserData(tid, uid);
    expect(dump.shop_user.email).toBe('erase@example.com');
    await eraseUserData(tid, uid);
    const rows = await q(`select 1 from shop_users where id=$1`, [uid]);
    expect(rows.length).toBe(0);
  });
});
