import { SignJWT, jwtVerify } from 'jose';
const secret = new TextEncoder().encode(process.env.SHOP_SESSION_SECRET!);

export type ShopClaims = { sub: string; tid: string; email: string };

export async function signShop(c: ShopClaims): Promise<string> {
  return new SignJWT(c).setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d').setIssuedAt().sign(secret);
}
export async function verifyShop(token: string): Promise<ShopClaims | null> {
  try { return (await jwtVerify(token, secret)).payload as unknown as ShopClaims; }
  catch { return null; }
}
