import Link from 'next/link';

const GROUPS: { title: string; links: { href: string; label: string; note?: string }[] }[] = [
  {
    title: 'Tenant app',
    links: [
      { href: '/app', label: 'Dashboard' },
      { href: '/app/products', label: 'Products' },
      { href: '/app/products/categories', label: 'Categories' },
      { href: '/app/distributors', label: 'Distributors' },
      { href: '/app/orders', label: 'Orders' },
      { href: '/login', label: 'Staff login' },
    ],
  },
  {
    title: 'Shop',
    links: [
      { href: '/shop/login', label: 'Shop login' },
      { href: '/shop/signup', label: 'Shop signup' },
    ],
  },
  {
    title: 'Admin',
    links: [{ href: '/admin/tenants', label: 'Tenants' }],
  },
  {
    title: 'System',
    links: [
      { href: '/forbidden', label: 'Forbidden (403)' },
      { href: '/not-found-tenant', label: 'Tenant not found' },
    ],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-[760px] px-6 py-16">
        <h1 className="font-display font-bold text-3xl tracking-tight">
          Tradon<span className="text-signal">.</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Page index. Tenant routes resolve under a tenant subdomain and require sign-in.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {GROUPS.map(group => (
            <section
              key={group.title}
              className="bg-surface border border-hairline rounded-card p-5"
            >
              <h2 className="font-display font-semibold text-sm text-ink mb-3">
                {group.title}
              </h2>
              <ul className="flex flex-col gap-1">
                {group.links.map(link => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center justify-between gap-3 rounded-ctl
                        px-3 py-2 text-sm text-ink hover:bg-surface-2"
                    >
                      <span>{link.label}</span>
                      <span className="font-mono text-xs text-muted">{link.href}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
