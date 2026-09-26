'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Warehouse } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/Field';
import { formErrors } from '@/components/ui/formErrors';
const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{2,5}$/, 'Use 2–5 letters or numbers.'),
  name: z.string().trim().min(1, 'Enter a warehouse name.').max(120),
  address: z.string().trim().max(500),
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;
export function WarehouseForm({
  warehouse,
  onSaved,
  onPending,
}: {
  warehouse?: Warehouse;
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
      code: warehouse?.code ?? '',
      name: warehouse?.name ?? '',
      address: warehouse?.address ?? '',
      is_active: warehouse?.is_active ?? true,
    },
  });
  async function save(values: Values) {
    onPending(true);
    try {
      await api(
        warehouse ? `/api/warehouses/${warehouse.id}` : '/api/warehouses',
        {
          method: warehouse ? 'PATCH' : 'POST',
          body: JSON.stringify(
            warehouse
              ? {
                  name: values.name,
                  address: values.address || null,
                  is_active: values.is_active,
                }
              : {
                  code: values.code,
                  name: values.name,
                  address: values.address || null,
                },
          ),
        },
      );
      toast.success(
        warehouse
          ? `${values.name} updated.`
          : `${values.name} created with a Stock location.`,
      );
      onSaved();
    } catch (error) {
      formErrors(error, setError, ['code', 'name', 'address', 'is_active']);
    } finally {
      onPending(false);
    }
  }
  const props = (name: keyof Values) => ({
    id: name,
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });
  return (
    <form onSubmit={handleSubmit(save)} noValidate>
      <fieldset disabled={isSubmitting} className="space-y-5">
        <Field name="code" label="Warehouse code" error={errors.code?.message}>
          <Input
            {...props('code')}
            readOnly={!!warehouse}
            {...register('code')}
          />
        </Field>
        <Field name="name" label="Warehouse name" error={errors.name?.message}>
          <Input {...props('name')} {...register('name')} />
        </Field>
        <Field name="address" label="Address" error={errors.address?.message}>
          <Textarea {...props('address')} {...register('address')} />
        </Field>
        {warehouse && (
          <Field
            name="is_active"
            label="Active warehouse"
            error={errors.is_active?.message}
          >
            <input
              {...props('is_active')}
              type="checkbox"
              className="size-5 accent-primary"
              {...register('is_active')}
            />
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
            : warehouse
              ? 'Save warehouse'
              : 'Create warehouse'}
        </Button>
      </fieldset>
    </form>
  );
}
