'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Location } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/Field';
import { formErrors } from '@/components/ui/formErrors';
const schema = z.object({
  name: z.string().trim().min(1, 'Enter a location name.').max(80),
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;
export function LocationForm({
  warehouse_id,
  location,
  onSaved,
  onPending,
}: {
  warehouse_id: number;
  location?: Location;
  onSaved: () => void;
  onPending: (pending: boolean) => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: location?.name ?? '',
      is_active: location?.is_active ?? true,
    },
  });
  async function save(values: Values) {
    onPending(true);
    try {
      await api(location ? `/api/locations/${location.id}` : '/api/locations', {
        method: location ? 'PATCH' : 'POST',
        body: JSON.stringify(
          location ? values : { warehouse_id, name: values.name },
        ),
      });
      toast.success(`${values.name} ${location ? 'updated' : 'created'}.`);
      onSaved();
    } catch (error) {
      formErrors(error, setError, ['name', 'is_active']);
    } finally {
      onPending(false);
    }
  }
  return (
    <form onSubmit={handleSubmit(save)} noValidate>
      <fieldset disabled={isSubmitting} className="space-y-5">
        <Field name="name" label="Location name" error={errors.name?.message}>
          <Input
            id="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
            {...register('name')}
          />
        </Field>
        {location && (
          <Field
            name="is_active"
            label="Active location"
            error={errors.is_active?.message}
          >
            <input
              id="is_active"
              type="checkbox"
              className="size-5 accent-primary"
              aria-invalid={!!errors.is_active}
              aria-describedby={
                errors.is_active ? 'is_active-error' : undefined
              }
              {...register('is_active')}
            />
            <p className="text-sm text-muted-foreground">
              A location with stock cannot be deactivated.
            </p>
          </Field>
        )}
        {errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting
            ? 'Saving…'
            : location
              ? 'Save location'
              : 'Create location'}
        </Button>
      </fieldset>
    </form>
  );
}
