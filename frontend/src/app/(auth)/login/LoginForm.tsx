'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/Field';
import { formErrors } from '@/components/ui/formErrors';
import { FormAlert } from '@/components/auth/FormAlert';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { emailField } from '@/components/auth/schemas';

const schema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password.'),
});
type Values = z.infer<typeof schema>;

export function LoginForm({ next, email }: { next: string; email: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email, password: '' },
  });

  // Already signed in? Skip the form.
  useEffect(() => {
    const controller = new AbortController();
    api<User>('/api/auth/me', { signal: controller.signal }).then(
      () => router.replace(next),
      () => {},
    );
    return () => controller.abort();
  }, [next, router]);

  async function submit(values: Values) {
    try {
      const user = await api<User>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      toast.success(`Welcome back, ${user.name}.`);
      router.replace(next);
      router.refresh();
    } catch (error) {
      resetField('password');
      formErrors(error, setError, ['email', 'password']);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Welcome back. Sign in to manage your inventory.
      </p>
      <form
        onSubmit={handleSubmit(submit)}
        noValidate
        className="mt-6 space-y-5"
      >
        <FormAlert message={errors.root?.message} />
        <Field name="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus={!email}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
        </Field>
        <Field
          name="password"
          label="Password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            autoFocus={!!email}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
          />
        </Field>
        <div className="-mt-2 text-right">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to StockSense?{' '}
        <Link
          href="/signup"
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
