import Link from 'next/link';
import { AuthLayout } from '@/components/ui/AuthLayout';
import { Input } from '@/components/ui/Input';
import { shopSignup } from '../actions';

export default function ShopSignupPage() {
  return (
    <AuthLayout
      brandTitle="Chi Retail"
      lead={<>Create your<br />store account.</>}
      sub="One account for ordering, deliveries, wallet and credit with Chi Distribution."
      markers={['2 MIN SETUP', 'NO FEES']}
    >
      {/* Segmented toggle */}
      <div className="flex bg-surface-2 border border-hairline rounded-full p-1 mb-6">
        <Link
          href="/shop/login"
          className="flex-1 text-center text-[12.5px] py-2 rounded-full text-muted"
        >
          Sign in
        </Link>
        <span className="flex-1 text-center text-[12.5px] py-2 rounded-full bg-surface text-ink font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          Create account
        </span>
      </div>

      <form action={shopSignup}>
        <Input label="Full name" name="full_name" type="text" required placeholder="Adaeze Okafor" />

        <div className="flex gap-3.5">
          <div className="flex-1">
            <Input label="Email" name="email" type="email" required placeholder="you@example.com" />
          </div>
          <div className="flex-1">
            <Input label="Phone" name="phone" type="tel" placeholder="801 234 5678" suffix="+234" />
          </div>
        </div>

        <div className="mb-2.5">
          <Input label="Password" name="password" type="password" required placeholder="••••••••••" />
        </div>

        <button
          type="submit"
          className="w-full h-[46px] rounded-ctl bg-primary text-on-primary font-display font-semibold text-sm flex items-center justify-center"
        >
          Create account
        </button>
      </form>

      <p className="mt-[22px] text-[11.5px] text-faint text-center leading-[1.55]">
        By continuing you accept the Terms &amp; Privacy Policy — the accepted version is recorded.
      </p>
    </AuthLayout>
  );
}
