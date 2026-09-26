import type { Metadata } from 'next';
import { safeNext } from '@/lib/session';
import { LoginEnvironment } from '@/components/motion/LoginEnvironment';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next, email } = await searchParams;
  return (
    <>
      <LoginEnvironment />
      <LoginForm
        next={safeNext(next)}
        email={typeof email === 'string' ? email : ''}
      />
    </>
  );
}
