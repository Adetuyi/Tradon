import { describe, it, expect } from 'vitest';
import { parseHost } from '@/lib/host';

describe('parseHost', () => {
  it('extracts tenant slug from subdomain', () => {
    expect(parseHost('chi.tradon.app')).toEqual({ kind: 'tenant', slug: 'chi' });
  });
  it('treats apex + app + www as platform', () => {
    expect(parseHost('tradon.app').kind).toBe('platform');
    expect(parseHost('app.tradon.app').kind).toBe('platform');
    expect(parseHost('www.tradon.app').kind).toBe('platform');
  });
  it('handles localhost dev with port', () => {
    expect(parseHost('chi.localhost:3000')).toEqual({ kind: 'tenant', slug: 'chi' });
    expect(parseHost('localhost:3000').kind).toBe('platform');
  });
  it('unknown host → custom (defer to domains lookup)', () => {
    expect(parseHost('shop.acme.com')).toEqual({ kind: 'custom', host: 'shop.acme.com' });
  });
});
