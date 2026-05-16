import { describe, it, expect } from 'vitest';
import { buttonClass } from '@/components/ui/Button';

describe('buttonClass', () => {
  it('maps variants to semantic classes', () => {
    expect(buttonClass('primary')).toContain('bg-primary');
    expect(buttonClass('danger')).toContain('bg-negative');
    expect(buttonClass('secondary')).toContain('bg-surface');
  });
});
