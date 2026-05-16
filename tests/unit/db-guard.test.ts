import { describe, it, expect, vi } from 'vitest';

describe('assertOwnDatabase', () => {
  it('throws when DATABASE_URL is not the 54332 DB', async () => {
    vi.resetModules();
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
    const { assertOwnDatabase } = await import('../helpers/db');
    expect(() => assertOwnDatabase()).toThrow(/54332/);
    expect(() => assertOwnDatabase()).toThrow(/not the f0-platform-foundation/i);
  });
});
