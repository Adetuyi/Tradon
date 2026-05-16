export type HostInfo =
  | { kind: 'tenant'; slug: string }
  | { kind: 'platform' }
  | { kind: 'custom'; host: string };

const ROOTS = ['tradon.app', 'localhost'];
const RESERVED = new Set(['', 'www', 'app']);

export function parseHost(rawHost: string): HostInfo {
  const host = rawHost.toLowerCase().split(':')[0];
  for (const root of ROOTS) {
    if (host === root) return { kind: 'platform' };
    if (host.endsWith(`.${root}`)) {
      const sub = host.slice(0, -(root.length + 1));
      if (RESERVED.has(sub)) return { kind: 'platform' };
      if (!sub.includes('.')) return { kind: 'tenant', slug: sub };
    }
  }
  return { kind: 'custom', host };
}
