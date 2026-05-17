import Link from 'next/link';
import { AuthLayout } from '@/components/ui/AuthLayout';
import { Input } from '@/components/ui/Input';
import { shopLogin } from '../actions';

export default function ShopLoginPage() {
  return (
    <AuthLayout
      brandTitle="Chi Retail"
      lead={<>Stock your shelves<br />before they&apos;re empty.</>}
      sub="Order from Chi Distribution directly, track deliveries, and manage your wallet and credit."
      markers={['FAST DELIVERY', 'WALLET & CREDIT']}
    >
      {/* Segmented toggle */}
      <div className="flex bg-surface-2 border border-hairline rounded-full p-1 mb-6">
        <span className="flex-1 text-center text-[12.5px] py-2 rounded-full bg-surface text-ink font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          Sign in
        </span>
        <Link
          href="/shop/signup"
          className="flex-1 text-center text-[12.5px] py-2 rounded-full text-muted"
        >
          Create account
        </Link>
      </div>

      <form action={shopLogin}>
        <Input label="Email" name="email" type="email" required placeholder="you@example.com" />
        <div className="mb-2">
          <Input label="Password" name="password" type="password" required placeholder="••••••••••" />
        </div>

        {/* Between row */}
        <div className="flex items-center justify-between mt-[-4px] mb-[22px]">
          <span className="text-xs text-muted">Remember me</span>
          <a href="#" className="text-[12.5px] text-signal font-medium">Forgot password?</a>
        </div>

        <button
          type="submit"
          className="w-full h-[46px] rounded-ctl bg-primary text-on-primary font-display font-semibold text-sm flex items-center justify-center"
        >
          Sign in
        </button>
      </form>

      <p className="mt-[22px] text-[11.5px] text-faint text-center leading-[1.55]">
        Powered by{' '}
        <span className="font-display font-bold tracking-tight text-[11.5px]">
          Tradon<span className="text-signal">.</span>
        </span>
        {' '}· this account is specific to Chi Retail
      </p>
    </AuthLayout>
  );
}
