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
      <h1 className="font-display font-bold text-2xl text-ink">Sign in</h1>
      <p className="text-sm text-muted mt-1.5 mb-7">to your staff workspace</p>
      <form action={staffLogin}>
        <Input label="Work email" name="email" type="email" required />
        <Input label="Password" name="password" type="password" required />
        <div className="mt-1"><Button variant="primary">Sign in</Button></div>
      </form>
    </AuthLayout>
  );
}
