'use server';
import { supabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function staffLogin(formData: FormData) {
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
  });
  if (error) redirect('/login?error=1');
  redirect('/app');
}
