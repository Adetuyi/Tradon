import { StorageAdapter } from './adapter';
export class FakeStorage implements StorageAdapter {
  private store = new Map<string, Buffer>();
  async putUrl(key: string): Promise<string> { return `memory://put/${key}`; }
  async markUploaded(key: string, bytes: Buffer) { this.store.set(key, bytes); }
  publicUrl(key: string): string { return `memory://public/${key}`; }
  async deleteObject(key: string): Promise<void> { this.store.delete(key); }
  has(key: string): boolean { return this.store.has(key); }
}
