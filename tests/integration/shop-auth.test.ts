import { describe, it, expect, beforeAll } from 'vitest';
import { q } from '../helpers/db';
import { registerShopUser, verifyShopLogin } from '@/lib/auth/shop';

let tA: string, tB: string;
beforeAll(async () => {
  await q(`delete from tenants where slug in ('sa-a','sa-b')`);
  [{ id: tA }] = await q<{id:string}>(`insert into tenants(name,slug)
    values('A','sa-a') returning id`);
  [{ id: tB }] = await q<{id:string}>(`insert into tenants(name,slug)
    values('B','sa-b') returning id`);
});

describe('shop auth', () => {
  it('same email is independent per tenant', async () => {
    await registerShopUser(tA, 'amaka@example.com', 'pw-aaaa-1', 'Amaka A');
    await registerShopUser(tB, 'amaka@example.com', 'pw-bbbb-2', 'Amaka B');
    expect(await verifyShopLogin(tA, 'amaka@example.com', 'pw-aaaa-1')).toBeTruthy();
    expect(await verifyShopLogin(tA, 'amaka@example.com', 'pw-bbbb-2')).toBeNull();
    expect(await verifyShopLogin(tB, 'amaka@example.com', 'pw-bbbb-2')).toBeTruthy();
  });
  it('rejects duplicate (tenant,email)', async () => {
    await expect(registerShopUser(tA, 'amaka@example.com', 'x', 'dup'))
      .rejects.toThrow();
  });
});
