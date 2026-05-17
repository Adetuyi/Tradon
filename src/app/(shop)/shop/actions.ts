'use server';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveTenant } from '@/lib/tenancy/resolveTenant';
import { registerShopUser, verifyShopLogin } from '@/lib/auth/shop';
import { signShop } from '@/lib/auth/shopSession';
import { recordConsent } from '@/lib/compliance/consent';

async function tenantOr404() {
  const t = await resolveTenant((await headers()).get('host') ?? '');
  if (!t) redirect('/not-found-tenant');
  return t;
}

export async function shopSignup(fd: FormData) {
  const t = await tenantOr404();
  const email = String(fd.get('email'));
  const id = await registerShopUser(t.id, email, String(fd.get('password')),
    String(fd.get('full_name')), String(fd.get('phone')) || undefined);
  await recordConsent({ tenantId: t.id, subject: `shop:${id}`,
    policy: 'terms', version: '2026-05-16' });
  (await cookies()).set('shop_session',
    await signShop({ sub: id, tid: t.id, email }),
    { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect('/shop');
}

export async function shopLogin(fd: FormData) {
  const t = await tenantOr404();
  const email = String(fd.get('email'));
  const u = await verifyShopLogin(t.id, email, String(fd.get('password')));
  if (!u) redirect('/shop/login?error=1');
  (await cookies()).set('shop_session',
    await signShop({ sub: u.id, tid: t.id, email }),
    { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect('/shop');
}
