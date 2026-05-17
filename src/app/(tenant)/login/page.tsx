import { AuthLayout } from '@/components/ui/AuthLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { staffLogin } from './actions';

export default function StaffLogin() {
  return (
    <AuthLayout brandTitle="Tradon."
      lead={<>Move stock,<br/>not spreadsheets.</>}
      sub="The distribution control room — orders, distributors, credit and collections in one place."
      markers={['MULTI-TENANT','RLS-ISOLATED','NDPA-READY']}>
      <h2 className="font-display font-bold text-2xl text-ink">Sign in</h2>
      <p className="text-sm text-muted mt-1.5 mb-7">to your staff workspace</p>
      <form action={staffLogin}>
        <Input label="Work email" name="email" type="email" required />
        <Input label="Password" name="password" type="password" required />
        <div className="flex items-center justify-between mt-[-4px] mb-[22px]">
          <span className="text-xs text-muted">Keep me signed in</span>
          <a href="#" className="text-[12.5px] text-signal font-medium">Forgot password?</a>
        </div>
        <div className="mt-1"><Button variant="primary">Sign in</Button></div>
      </form>
      <p className="mt-[22px] text-[11.5px] text-faint text-center leading-[1.55]">
        Staff accounts are provisioned by your administrator.
      </p>
    </AuthLayout>
  );
}
