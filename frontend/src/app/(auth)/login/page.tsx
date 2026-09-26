import type { Metadata } from 'next';
import { safeNext } from '@/lib/session';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next, email } = await searchParams;
  return (
    <LoginForm
      next={safeNext(next)}
      email={typeof email === 'string' ? email : ''}
    />
  );
}
