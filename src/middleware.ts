import { NextRequest, NextResponse } from 'next/server';
import { parseHost } from '@/lib/host';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const info = parseHost(host);
  const res = NextResponse.next();
  if (info.kind === 'tenant') res.headers.set('x-tenant-slug', info.slug);
  if (info.kind === 'custom') res.headers.set('x-tenant-host', info.host);
  res.headers.set('x-host-kind', info.kind);
  return res;
}
export const config = { matcher: ['/((?!_next|favicon.ico).*)'] };
