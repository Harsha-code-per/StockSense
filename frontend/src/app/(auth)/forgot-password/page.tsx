'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/Field';
import { formErrors } from '@/components/ui/formErrors';
import { FormAlert } from '@/components/auth/FormAlert';
import { PasswordInput } from '@/components/auth/PasswordInput';
import {
  emailField,
  newPasswordField,
  otpField,
  PASSWORD_HINT,
} from '@/components/auth/schemas';

type Step = 'email' | 'code' | 'password';
const STEPS: Record<Step, { n: number; title: string }> = {
  email: { n: 1, title: 'Reset your password' },
  code: { n: 2, title: 'Enter the code' },
  password: { n: 3, title: 'Choose a new password' },
};
const OTP_ERRORS = ['OTP_INVALID', 'OTP_EXPIRED', 'TOO_MANY_ATTEMPTS'];

function requestCode(email: string) {
  return api<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  return (
    <>
      <p className="text-xs font-medium text-muted-foreground">
        Step {STEPS[step].n} of 3
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {STEPS[step].title}
      </h1>
      {step === 'email' && (
        <EmailStep
          onSent={(value) => {
            setEmail(value);
            setStep('code');
          }}
        />
      )}
      {step === 'code' && (
        <CodeStep
          email={email}
          onVerified={(value) => {
            setOtp(value);
            setStep('password');
          }}
          onChangeEmail={() => setStep('email')}
        />
      )}
      {step === 'password' && (
        <PasswordStep
          email={email}
          otp={otp}
          onCodeRejected={() => setStep('code')}
        />
      )}
      <Link
        href="/login"
        className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to sign in
      </Link>
    </>
  );
}

const emailSchema = z.object({ email: emailField });

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });
  async function submit({ email }: { email: string }) {
    try {
      const { message } = await requestCode(email);
      toast.success(message);
      onSent(email);
    } catch (error) {
      formErrors(error, setError, ['email']);
    }
  }
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="mt-6 space-y-5">
      <p className="text-sm text-muted-foreground">
        Enter your account email and we&apos;ll send you a 6-digit code.
      </p>
      <FormAlert message={errors.root?.message} />
      <Field name="email" label="Email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
      </Field>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Sending code…' : 'Send code'}
      </Button>
    </form>
  );
}

const codeSchema = z.object({ otp: otpField });

function CodeStep({
  email,
  onVerified,
  onChangeEmail,
}: {
  email: string;
  onVerified: (otp: string) => void;
  onChangeEmail: () => void;
}) {
  const [resending, setResending] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { otp: '' },
  });
  async function submit({ otp }: { otp: string }) {
    try {
      await api('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      });
      onVerified(otp);
    } catch (error) {
      if (error instanceof ApiError && OTP_ERRORS.includes(error.code)) {
        setError('otp', { message: error.message });
      } else {
        formErrors(error, setError, ['otp']);
      }
    }
  }
  async function resend() {
    setResending(true);
    try {
      await requestCode(email);
      reset();
      toast.success('A new code is on its way. Older codes no longer work.');
    } catch (error) {
      formErrors(error, setError, []);
    } finally {
      setResending(false);
    }
  }
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="mt-6 space-y-5">
      <p className="text-sm text-muted-foreground">
        If an account exists for{' '}
        <span className="font-medium text-foreground">{email}</span>, we sent a
        6-digit code. It expires in 10 minutes.
      </p>
      <FormAlert message={errors.root?.message} />
      <Field name="otp" label="Verification code" error={errors.otp?.message}>
        <Input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          placeholder="123456"
          className="text-center font-mono text-lg tracking-[0.5em]"
          aria-invalid={!!errors.otp}
          aria-describedby={errors.otp ? 'otp-error' : undefined}
          {...register('otp')}
        />
      </Field>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Checking…' : 'Verify code'}
      </Button>
      <div className="flex justify-between text-sm">
        <button
          type="button"
          onClick={onChangeEmail}
          className="font-medium text-muted-foreground hover:text-foreground"
        >
          Use a different email
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={resending}
          className="font-medium text-primary hover:underline disabled:opacity-50"
        >
          {resending ? 'Sending…' : 'Send a new code'}
        </button>
      </div>
    </form>
  );
}

const passwordSchema = z
  .object({
    new_password: newPasswordField,
    confirm: z.string().min(1, 'Re-enter your new password.'),
  })
  .refine((v) => v.new_password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match.',
  });
type PasswordValues = z.infer<typeof passwordSchema>;

function PasswordStep({
  email,
  otp,
  onCodeRejected,
}: {
  email: string;
  otp: string;
  onCodeRejected: () => void;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { new_password: '', confirm: '' },
  });
  async function submit({ new_password }: PasswordValues) {
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, otp, new_password }),
      });
      toast.success('Password updated. Sign in with your new password.');
      router.replace(`/login?email=${encodeURIComponent(email)}`);
    } catch (error) {
      if (error instanceof ApiError && OTP_ERRORS.includes(error.code)) {
        toast.error(error.message);
        onCodeRejected(); // code expired meanwhile: back to step 2
        return;
      }
      formErrors(error, setError, ['new_password']);
    }
  }
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="mt-6 space-y-5">
      <FormAlert message={errors.root?.message} />
      <Field
        name="new_password"
        label="New password"
        error={errors.new_password?.message}
      >
        <PasswordInput
          id="new_password"
          autoComplete="new-password"
          autoFocus
          aria-invalid={!!errors.new_password}
          aria-describedby={
            errors.new_password
              ? 'new_password-error password-hint'
              : 'password-hint'
          }
          {...register('new_password')}
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          {PASSWORD_HINT}
        </p>
      </Field>
      <Field
        name="confirm"
        label="Confirm new password"
        error={errors.confirm?.message}
      >
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          aria-invalid={!!errors.confirm}
          aria-describedby={errors.confirm ? 'confirm-error' : undefined}
          {...register('confirm')}
        />
      </Field>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}
