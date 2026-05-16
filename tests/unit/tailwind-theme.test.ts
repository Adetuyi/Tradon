import { describe, it, expect } from 'vitest';
import config from '../../tailwind.config';

describe('tailwind theme', () => {
  it('exposes brand semantic colors from brand-spec', () => {
    const colors = (config.theme?.extend?.colors ?? {}) as Record<string, unknown>;
    expect(colors.primary).toBe('var(--color-primary)');
    expect(colors.paper).toBe('var(--color-paper)');
    expect(colors.ink).toBe('var(--color-ink)');
    expect(colors.signal).toBe('var(--color-signal)');
  });
});
