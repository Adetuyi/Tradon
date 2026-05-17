import { describe, it, expect } from 'vitest';
import { q } from '../helpers/db';
import { createCategory, renameCategory, archiveCategory, listCategories, getOrCreateCategory }
  from '@/lib/products/categories';

async function tid(slug:string){ await q(`delete from tenants where slug=$1`,[slug]);
  const [t]=await q<{id:string}>(`insert into tenants(name,slug) values('C',$1) returning id`,[slug]);
  return t.id; }

describe('categories domain', () => {
  it('create/rename/archive + inline get-or-create + active listing', async () => {
    const t = await tid('cd-1');
    const id = await createCategory(t, 'Snacks');
    await renameCategory(t, id, 'Snacks & Confectionery');
    const again = await getOrCreateCategory(t, 'snacks & confectionery'); // case-insensitive hit
    expect(again).toBe(id);
    const fresh = await getOrCreateCategory(t, 'Drinks'); // creates
    expect(fresh).not.toBe(id);
    await archiveCategory(t, fresh);
    const active = await listCategories(t);
    expect(active.map(c=>c.name)).toContain('Snacks & Confectionery');
    expect(active.map(c=>c.name)).not.toContain('Drinks'); // archived hidden
  });
});
