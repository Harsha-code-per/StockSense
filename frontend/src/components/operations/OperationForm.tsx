// Owner: Member 3. Create form for operations (Phase 2: receipt flow wired).
// zod + react-hook-form, server field_errors mapped onto the same fields.
// The backend is authoritative for validation and stock; this form only
// collects input and sends OperationCreate per docs/API.md.

'use client';

import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { ApiError } from '@/lib/api';
import type {
  Location,
  OperationCreate,
  OperationType,
  Page,
  Product,
} from '@/lib/types';
import { createOperation, TYPE_LABELS, TYPE_ROUTES } from '@/lib/operations';
import { useApi } from '@/components/ui/useApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, selectClass } from '@/components/ui/Field';
import { DataState } from '@/components/ui/DataState';
import { formErrors } from '@/components/ui/formErrors';
import { LineEditor } from './LineEditor';

// up to 3 decimals, > 0 — mirrors INVENTORY_RULES §Validation (UX only)
const quantity = z
  .string()
  .trim()
  .min(1, 'Enter a quantity.')
  .regex(
    /^\d{1,15}(\.\d{1,3})?$/,
    'Enter a positive quantity with up to 3 decimal places.',
  )
  .refine((value) => Number(value) > 0, 'Quantity must be greater than 0.');

const lineSchema = z.object({
  product_id: z.string().min(1, 'Choose a product.'),
  quantity,
});

const baseSchema = z.object({
  source_location_id: z.string(),
  destination_location_id: z.string(),
  partner_name: z.string().trim().max(120),
  scheduled_date: z.string(),
  notes: z.string().trim().max(2000),
  lines: z.array(lineSchema).min(1, 'Add at least one line.'),
});

export type OperationFormValues = z.infer<typeof baseSchema>;

// Per-type field configuration (docs/API.md "OperationCreate" per type)
const TYPE_CONFIG: Record<
  'receipt' | 'delivery',
  {
    locationField: 'source_location_id' | 'destination_location_id';
    locationLabel: string;
    locationRequired: string;
    partnerLabel: string;
    partnerPlaceholder: string;
  }
> = {
  receipt: {
    locationField: 'destination_location_id',
    locationLabel: 'Destination location',
    locationRequired: 'Choose a destination location.',
    partnerLabel: 'Vendor',
    partnerPlaceholder: 'e.g. Tata Steel Ltd',
  },
  delivery: {
    locationField: 'source_location_id',
    locationLabel: 'Source location',
    locationRequired: 'Choose a source location.',
    partnerLabel: 'Customer',
    partnerPlaceholder: 'e.g. BuildCo',
  },
};

function makeSchema(type: OperationType) {
  const config = TYPE_CONFIG[type as 'receipt' | 'delivery'];
  return baseSchema.superRefine((values, ctx) => {
    if (!values[config.locationField]) {
      ctx.addIssue({
        code: 'custom',
        path: [config.locationField],
        message: config.locationRequired,
      });
    }
    const seen = new Set<string>();
    values.lines.forEach((line, index) => {
      if (!line.product_id) return;
      if (seen.has(line.product_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['lines', index, 'product_id'],
          message: 'This product is already on another line.',
        });
      }
      seen.add(line.product_id);
    });
  });
}

const FIELDS = [
  'source_location_id',
  'destination_location_id',
  'partner_name',
  'scheduled_date',
  'notes',
  'lines',
] as const;

export function OperationForm({ type }: { type: OperationType }) {
  const router = useRouter();
  const locations = useApi<Location[]>('/api/locations?is_active=true');
  const products = useApi<Page<Product>>(
    '/api/products?page_size=100&is_active=true',
  );
  const label = TYPE_LABELS[type];
  const config = TYPE_CONFIG[type as 'receipt' | 'delivery'];

  const form = useForm<OperationFormValues>({
    resolver: zodResolver(makeSchema(type)),
    defaultValues: {
      source_location_id: '',
      destination_location_id: '',
      partner_name: '',
      scheduled_date: '',
      notes: '',
      lines: [{ product_id: '', quantity: '' }],
    },
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;
  const sourceLocationId = useWatch({
    control: form.control,
    name: 'source_location_id',
  });

  async function save(values: OperationFormValues) {
    const body: OperationCreate = {
      type,
      source_location_id: values.source_location_id
        ? Number(values.source_location_id)
        : null,
      destination_location_id: values.destination_location_id
        ? Number(values.destination_location_id)
        : null,
      partner_name: values.partner_name || null,
      scheduled_date: values.scheduled_date || null,
      notes: values.notes || null,
      lines: values.lines.map((line) => ({
        product_id: Number(line.product_id),
        quantity: line.quantity,
      })),
    };
    try {
      const created = await createOperation(body);
      toast.success(`${label} ${created.reference} created.`);
      router.push(`${TYPE_ROUTES[type]}/${created.id}`);
    } catch (error) {
      formErrors(error, setError, FIELDS);
      // map server line errors ("lines.0.quantity") onto the line inputs
      if (error instanceof ApiError) {
        for (const item of error.field_errors) {
          if (/^lines\.\d+\./.test(item.field)) {
            setError(item.field as `lines.${number}.product_id`, {
              message: item.message,
            });
          }
        }
      }
    }
  }

  if (locations.error)
    return <DataState error={locations.error} retry={locations.reload} />;
  if (products.error)
    return <DataState error={products.error} retry={products.reload} />;

  const props = (name: keyof OperationFormValues) => ({
    id: name,
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  return (
    <FormProvider {...form}>
      <form
        onSubmit={handleSubmit(save)}
        noValidate
        className="max-w-3xl space-y-6 rounded-xl border bg-card p-5 sm:p-7"
      >
        <fieldset disabled={isSubmitting} className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              name={config.locationField}
              label={config.locationLabel}
              error={errors[config.locationField]?.message}
            >
              <select
                {...props(config.locationField)}
                className={selectClass}
                disabled={locations.loading}
                {...register(config.locationField)}
              >
                <option value="">
                  {locations.loading ? 'Loading locations…' : 'Choose a location'}
                </option>
                {locations.data?.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              name="partner_name"
              label={config.partnerLabel}
              error={errors.partner_name?.message}
            >
              <Input
                {...props('partner_name')}
                placeholder={config.partnerPlaceholder}
                autoComplete="off"
                {...register('partner_name')}
              />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              name="scheduled_date"
              label="Scheduled date"
              error={errors.scheduled_date?.message}
            >
              <Input
                {...props('scheduled_date')}
                type="date"
                {...register('scheduled_date')}
              />
            </Field>
          </div>
          <Field name="notes" label="Notes" error={errors.notes?.message}>
            <Textarea
              {...props('notes')}
              rows={2}
              placeholder="Optional"
              {...register('notes')}
            />
          </Field>

          <div className="space-y-2">
            <h2 className="font-medium">Products</h2>
            {products.loading ? (
              <DataState loading />
            ) : products.data && products.data.items.length === 0 ? (
              <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">
                No active products yet. Ask a manager to create products first.
              </p>
            ) : (
              <LineEditor
                products={products.data?.items ?? []}
                availabilityLocationId={
                  type === 'delivery' ? sourceLocationId : undefined
                }
              />
            )}
          </div>

          {errors.root?.message && (
            <p role="alert" className="text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
          <div className="flex flex-wrap gap-3 border-t pt-5">
            <Button
              type="submit"
              disabled={
                isSubmitting || locations.loading || products.loading
              }
            >
              {isSubmitting ? 'Saving…' : `Create ${label.toLowerCase()}`}
            </Button>
            <Button variant="outline" asChild>
              <Link href={TYPE_ROUTES[type]}>Cancel</Link>
            </Button>
          </div>
        </fieldset>
      </form>
    </FormProvider>
  );
}
