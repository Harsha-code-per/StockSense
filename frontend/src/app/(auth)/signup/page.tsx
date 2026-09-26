'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { DEFAULT_AFTER_LOGIN } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/Field';
import { formErrors } from '@/components/ui/formErrors';
import { FormAlert } from '@/components/auth/FormAlert';
import { PasswordInput } from '@/components/auth/PasswordInput';
import {
  emailField,
  newPasswordField,
  PASSWORD_HINT,
} from '@/components/auth/schemas';

const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Enter your full name (at least 2 characters).')
      .max(120, 'Use at most 120 characters.'),
    email: emailField,
    password: newPasswordField,
    confirm: z.string().min(1, 'Re-enter your password.'),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match.',
  });
type Values = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirm: '' },
  });

  async function submit({ name, email, password }: Values) {
    try {
      const user = await api<User>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      toast.success(`Account created. Welcome, ${user.name}.`);
      router.replace(DEFAULT_AFTER_LOGIN);
      router.refresh();
    } catch (error) {
      formErrors(error, setError, ['name', 'email', 'password']);
    }
  }

  const describe = (field: keyof Values, hint?: string) =>
    [errors[field] ? `${field}-error` : '', hint ?? ''].join(' ').trim() ||
    undefined;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        New accounts start with Staff access.
      </p>
      <form
        onSubmit={handleSubmit(submit)}
        noValidate
        className="mt-6 space-y-5"
      >
        <FormAlert message={errors.root?.message} />
        <Field name="name" label="Full name" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            autoFocus
            aria-invalid={!!errors.name}
            aria-describedby={describe('name')}
            {...register('name')}
          />
        </Field>
        <Field name="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={describe('email')}
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
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby={describe('password', 'password-hint')}
            {...register('password')}
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            {PASSWORD_HINT}
          </p>
        </Field>
        <Field
          name="confirm"
          label="Confirm password"
          error={errors.confirm?.message}
        >
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            aria-invalid={!!errors.confirm}
            aria-describedby={describe('confirm')}
            {...register('confirm')}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
