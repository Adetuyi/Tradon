import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'green-50': 'var(--color-green-50)', 'green-100': 'var(--color-green-100)',
        'green-200': 'var(--color-green-200)', 'green-400': 'var(--color-green-400)',
        primary: 'var(--color-primary)', 'primary-700': 'var(--color-green-700)',
        'green-900': 'var(--color-green-900)',
        paper: 'var(--color-paper)', surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)', hairline: 'var(--color-border)',
        'hairline-strong': 'var(--color-border-strong)',
        ink: 'var(--color-ink)', text: 'var(--color-text)',
        muted: 'var(--color-muted)', faint: 'var(--color-faint)',
        positive: 'var(--color-positive)', negative: 'var(--color-negative)',
        signal: 'var(--color-signal)', 'on-primary': 'var(--color-on-primary)',
        'on-deep': 'var(--color-on-deep)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui'],
        body: ['var(--font-body)', 'system-ui'],
        mono: ['var(--font-mono)', 'ui-monospace', 'Menlo'],
      },
      borderRadius: { card: '14px', ctl: '9px' },
      boxShadow: { card: '0 1px 2px rgba(15,51,34,.04),0 10px 30px -18px rgba(15,51,34,.22)' },
    },
  },
  plugins: [],
};
export default config;
