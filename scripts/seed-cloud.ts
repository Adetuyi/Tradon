/**
 * Seed a fresh Supabase project (cloud or local) with a working tenant:
 *   1. Create (or reuse) a Supabase Auth user — this becomes the Owner.
 *   2. Insert (or reuse) a `tenants` row.
 *   3. Insert (or reuse) the `<slug>.tradon.app` subdomain in `domains`.
 *   4. Insert (or reuse) a `tenant_members` row binding the user as Owner.
 *
 * Idempotent: re-running with the same email / slug is safe.
 *
 * Usage (reads .env.local automatically; needs SUPABASE_SERVICE_ROLE_KEY):
 *   pnpm seed:cloud --email you@x.com --password 'Pass!234' \
 *                    --slug chi --name 'Chi Distribution Ltd'
 *
 * Or via env vars:
 *   SEED_EMAIL=you@x.com SEED_PASSWORD='Pass!234' SEED_SLUG=chi \
 *   SEED_NAME='Chi Distribution Ltd' pnpm seed:cloud
 *
 * Output is the credentials to use at /login on `<slug>.<your-cloud-root>`.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Args = { email: string; password: string; slug: string; name: string };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.findIndex(a => a === `--${flag}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const email = get('email') ?? process.env.SEED_EMAIL;
  const password = get('password') ?? process.env.SEED_PASSWORD;
  const slug = get('slug') ?? process.env.SEED_SLUG;
  const name = get('name') ?? process.env.SEED_NAME;
  if (!email || !password || !slug || !name) {
    console.error(
      'Missing args. Usage:\n' +
      '  pnpm seed:cloud --email <e> --password <p> --slug <s> --name <n>\n' +
      'Or set SEED_EMAIL / SEED_PASSWORD / SEED_SLUG / SEED_NAME.',
    );
    process.exit(1);
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    console.error(`Bad slug "${slug}" — must match /^[a-z0-9-]+$/`);
    process.exit(1);
  }
  return { email, password, slug, name };
}

async function findUserByEmail(
  sb: SupabaseClient, email: string,
): Promise<{ id: string } | null> {
  // Paginate Auth users; small dev DBs only — fine for seeding.
  const perPage = 1000;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const hit = data.users.find(u => (u.email ?? '').toLowerCase() === email.toLowerCase());
    if (hit) return { id: hit.id };
    if (data.users.length < perPage) return null;
  }
  return null;
}

async function ensureAuthUser(
  sb: SupabaseClient, email: string, password: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await findUserByEmail(sb, email);
  if (existing) return { id: existing.id, created: false };
  const { data, error } = await sb.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  return { id: data.user.id, created: true };
}

async function ensureTenant(
  sb: SupabaseClient, slug: string, name: string,
): Promise<{ id: string; created: boolean }> {
  const { data: existing, error: selErr } = await sb
    .from('tenants').select('id').eq('slug', slug).maybeSingle();
  if (selErr) throw new Error(`tenant select failed: ${selErr.message}`);
  if (existing) return { id: existing.id, created: false };
  const { data, error } = await sb.from('tenants')
    .insert({ name, slug, region: 'NG', currency: 'NGN' })
    .select('id').single();
  if (error || !data) throw new Error(`tenant insert failed: ${error?.message}`);
  return { id: data.id, created: true };
}

async function ensureSubdomain(
  sb: SupabaseClient, tenantId: string, slug: string,
): Promise<{ created: boolean }> {
  const host = `${slug}.tradon.app`;
  const { data: existing, error: selErr } = await sb
    .from('domains').select('id').eq('host', host).maybeSingle();
  if (selErr) throw new Error(`domains select failed: ${selErr.message}`);
  if (existing) return { created: false };
  const { error } = await sb.from('domains')
    .insert({ tenant_id: tenantId, host, type: 'subdomain' });
  if (error) throw new Error(`domains insert failed: ${error.message}`);
  return { created: true };
}

async function ensureOwnerMembership(
  sb: SupabaseClient, tenantId: string, userId: string,
): Promise<{ created: boolean }> {
  const { data: existing, error: selErr } = await sb
    .from('tenant_members').select('user_id')
    .eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (selErr) throw new Error(`tenant_members select failed: ${selErr.message}`);
  if (existing) return { created: false };
  const { error } = await sb.from('tenant_members')
    .insert({ user_id: userId, tenant_id: tenantId, role: 'Owner' });
  if (error) throw new Error(`tenant_members insert failed: ${error.message}`);
  return { created: true };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY ' +
      '(run via `pnpm seed:cloud` which loads .env.local).',
    );
    process.exit(1);
  }
  const args = parseArgs();
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  console.log('• Ensuring auth user…');
  const user = await ensureAuthUser(sb, args.email, args.password);
  console.log(`  ${user.created ? 'created' : 'reused'}  user_id=${user.id}`);

  console.log('• Ensuring tenant…');
  const tenant = await ensureTenant(sb, args.slug, args.name);
  console.log(`  ${tenant.created ? 'created' : 'reused'}  tenant_id=${tenant.id}  slug=${args.slug}`);

  console.log('• Ensuring subdomain…');
  const dom = await ensureSubdomain(sb, tenant.id, args.slug);
  console.log(`  ${dom.created ? 'created' : 'reused'}  host=${args.slug}.tradon.app`);

  console.log('• Ensuring Owner membership…');
  const mem = await ensureOwnerMembership(sb, tenant.id, user.id);
  console.log(`  ${mem.created ? 'created' : 'reused'}  role=Owner`);

  console.log('\n✅ Seed complete.');
  console.log(`Sign in at  <slug>.<your-cloud-root>/login`);
  console.log(`         →  ${args.slug}.tradon.app/login`);
  console.log(`Email      ${args.email}`);
  console.log(`Password   (the one you provided)`);
  console.log('\nNote: src/lib/host.ts ROOTS only knows tradon.app + localhost.');
  console.log('If your cloud domain is different (e.g. tradon.vercel.app), add it');
  console.log('to ROOTS and add a row in `domains` here OR use the apex with preview mode.');
}

main().catch(e => {
  console.error('\n❌ Seed failed:', e.message);
  process.exit(1);
});
