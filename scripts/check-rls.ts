import { execSync } from 'node:child_process';
execSync('pnpm vitest run tests/integration/rls-guard.test.ts', { stdio: 'inherit' });
