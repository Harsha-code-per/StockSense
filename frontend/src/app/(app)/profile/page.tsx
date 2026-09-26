'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Calendar,
  Check,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Shield,
  User as UserIcon,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/Field';
import { DataState } from '@/components/ui/DataState';
import { formErrors } from '@/components/ui/formErrors';
import { useApi } from '@/components/ui/useApi';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(120, 'Name cannot exceed 120 characters.'),
});

type ProfileValues = z.infer<typeof profileSchema>;
const profileFields = ['name'] as const;

function formatDate(isoStr: string | undefined): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoStr;
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const user = useApi<User>('/api/auth/me');

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    if (user.data?.name) {
      reset({ name: user.data.name });
    }
  }, [user.data?.name, reset]);

  async function onUpdateName(values: ProfileValues) {
    try {
      const updated = await api<User>('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: values.name }),
      });
      toast.success('Profile updated successfully.');
      reset({ name: updated.name });
      user.reload();
    } catch (error) {
      formErrors(error, setError, profileFields);
    }
  }

  async function handleLogout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
      toast.success('Signed out successfully.');
    } catch {
      // Even if network fails, proceed with client redirection
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  if (user.loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Profile"
          description="View your account details, manage your name, and access security settings."
        />
        <DataState loading />
      </div>
    );
  }

  if (user.error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Profile"
          description="View your account details, manage your name, and access security settings."
        />
        <DataState error={user.error} retry={user.reload} />
      </div>
    );
  }

  const currentUser = user.data;
  if (!currentUser) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Profile"
        description="View your account details, manage your profile information, and handle session actions."
      />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Account Overview Card */}
        <section
          aria-label="Account Overview"
          className="rounded-xl border bg-card p-6 shadow-xs lg:col-span-1"
        >
          <div className="flex flex-col items-center text-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserIcon className="size-10" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground">
              {currentUser.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{currentUser.email}</p>

            <div className="mt-3">
              <Badge
                className={
                  currentUser.role === 'manager'
                    ? 'bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-xs'
                    : 'bg-secondary text-secondary-foreground font-medium uppercase tracking-wider text-xs'
                }
              >
                {currentUser.role}
              </Badge>
            </div>
          </div>

          <div className="mt-6 space-y-3.5 border-t pt-6 text-sm">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Shield className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Role: <strong className="font-medium text-foreground capitalize">{currentUser.role}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3 text-muted-foreground">
              <Mail className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">
                Email: <span className="font-medium text-foreground">{currentUser.email}</span>
              </span>
            </div>

            <div className="flex items-center gap-3 text-muted-foreground">
              <Calendar className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Member since: <span className="font-medium text-foreground">{formatDate(currentUser.created_at)}</span>
              </span>
            </div>
          </div>
        </section>

        {/* Right Column: Update Name & Security Settings */}
        <div className="space-y-8 lg:col-span-2">
          {/* Edit Profile Form */}
          <section
            aria-label="Edit Profile Details"
            className="rounded-xl border bg-card p-6 shadow-xs sm:p-7"
          >
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Personal Information
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Update your display name across inventory operations and ledger audits.
            </p>

            <form onSubmit={handleSubmit(onUpdateName)} noValidate className="mt-6">
              <fieldset disabled={isSubmitting} className="space-y-5">
                <Field name="name" label="Full name" error={errors.name?.message}>
                  <Input
                    id="name"
                    autoComplete="name"
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'name-error' : undefined}
                    {...register('name')}
                  />
                </Field>

                <Field name="email" label="Email address">
                  <Input
                    id="email"
                    type="email"
                    value={currentUser.email}
                    disabled
                    readOnly
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Email address cannot be modified once registered.
                  </p>
                </Field>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !isDirty}
                    className="gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="size-4" aria-hidden="true" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </Button>
                </div>
              </fieldset>
            </form>
          </section>

          {/* Session and Logout Card */}
          <section
            aria-label="Session Management"
            className="rounded-xl border border-destructive/20 bg-card p-6 shadow-xs sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Session & Sign Out
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  End your current session on this device. You will need to sign in again to access inventory.
                </p>
              </div>
              <KeyRound className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-5">
              <div className="text-xs text-muted-foreground">
                Current active session: <span className="font-mono text-foreground font-medium">JWT httpOnly cookie</span>
              </div>

              <Button
                type="button"
                variant="destructive"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span>Sign Out</span>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
