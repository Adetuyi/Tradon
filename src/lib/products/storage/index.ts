import { StorageAdapter } from './adapter';
import { FakeStorage } from './fake';
let cached: StorageAdapter | null = null;
export function getStorage(): StorageAdapter {
  if (cached) return cached;
  if (process.env.R2_BUCKET && process.env.R2_ACCOUNT_ID) {
    const { R2Storage } = require('./r2') as typeof import('./r2');
    cached = new R2Storage();
  } else {
    cached = new FakeStorage();
  }
  return cached!;
}
export function __resetStorage() { cached = null; }
