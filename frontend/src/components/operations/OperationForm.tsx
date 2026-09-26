// Owner: Member 3. Create form for operations (all four types).
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

// up to 3 decimals — mirrors INVENTORY_RULES §Validation (UX only; the
// server re-checks everything).
const quantity = z
  .string()
  .trim()
  .min(1, 'Enter a quantity.')
  .regex(
    /^\d{1,15}(\.\d{1,3})?$/,
    'Enter a positive quantity with up to 3 decimal places.',
  )
  .refine((value) => Number(value) > 0, 'Quantity must be greater than 0.');

// counted_quantity ≥ 0 is valid for adjustments (zero is a legal count).
const countedQuantity = z
  .string()
  .trim()
  .min(1, 'Enter the counted quantity.')
  .regex(
    /^\d{1,15}(\.\d{1,3})?$/,
    'Enter a non-negative quantity with up to 3 decimal places.',
  );

const baseSchema = z.object({
  source_location_id: z.string(),
  destination_location_id: z.string(),
  partner_name: z.string().trim().max(120),
  scheduled_date: z.string(),
  notes: z.string().trim().max(2000),
  lines: z
    .array(
      z.object({
        product_id: z.string().min(1, 'Choose a product.'),
        quantity: z.string().trim(),
        counted_quantity: z.string().trim(),
      }),
    )
    .min(1, 'Add at least one line.'),
});

export type OperationFormValues = z.infer<typeof baseSchema>;

// Per-type field configuration (docs/API.md "OperationCreate" per type)
const TYPE_CONFIG: Record<
  OperationType,
  {
    source?: { label: string; required: string };
    destination?: { label: string; required: string };
    partner?: { label: string; placeholder: string };
    lineKind: 'quantity' | 'counted';
    /** lines show availability at the source location */
    sourceAvailability: boolean;
  }
> = {
  receipt: {
    destination: {
      label: 'Destination location',
      required: 'Choose a destination location.',
    },
    partner: { label: 'Vendor', placeholder: 'e.g. Tata Steel Ltd' },
    lineKind: 'quantity',
    sourceAvailability: false,
  },
  delivery: {
    source: { label: 'Source location', required: 'Choose a source location.' },
    partner: { label: 'Customer', placeholder: 'e.g. BuildCo' },
    lineKind: 'quantity',
    sourceAvailability: true,
  },
  transfer: {
    source: { label: 'Source location', required: 'Choose a source location.' },
    destination: {
      label: 'Destination location',
      required: 'Choose a destination location.',
    },
    lineKind: 'quantity',
    sourceAvailability: true,
  },
  adjustment: {
    source: { label: 'Counted location', required: 'Choose a location.' },
    lineKind: 'counted',
    sourceAvailability: true,
  },
};

function makeSchema(type: OperationType) {
  const config = TYPE_CONFIG[type];
  return baseSchema.superRefine((values, ctx) => {
    if (config.source && !values.source_location_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['source_location_id'],
        message: config.source.required,
      });
    }
    if (config.destination && !values.destination_location_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['destination_location_id'],
        message: config.destination.required,
      });
    }
    if (
      type === 'transfer' &&
      values.source_location_id &&
      values.source_location_id === values.destination_location_id
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['destination_location_id'],
        message: 'Source and destination must be different locations.',
      });
    }
    const seen = new Set<string>();
    values.lines.forEach((line, index) => {
      if (line.product_id) {
        if (seen.has(line.product_id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['lines', index, 'product_id'],
            message: 'This product is already on another line.',
          });
        }
        seen.add(line.product_id);
      }
      const check =
        config.lineKind === 'counted'
          ? countedQuantity.safeParse(line.counted_quantity)
          : quantity.safeParse(line.quantity);
      if (!check.success) {
        ctx.addIssue({
          code: 'custom',
          path: [
            'lines',
            index,
            config.lineKind === 'counted' ? 'counted_quantity' : 'quantity',
          ],
          message: check.error.issues[0]?.message ?? 'Invalid value.',
        });
      }
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
  const config = TYPE_CONFIG[type];

  const form = useForm<OperationFormValues>({
    resolver: zodResolver(makeSchema(type)),
    defaultValues: {
      source_location_id: '',
      destination_location_id: '',
      partner_name: '',
      scheduled_date: '',
      notes: '',
      lines: [{ product_id: '', quantity: '', counted_quantity: '' }],
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
        ...(config.lineKind === 'counted'
          ? { counted_quantity: line.counted_quantity }
          : { quantity: line.quantity }),
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

  const locationSelect = (
    which: 'source' | 'destination',
    fieldConfig: NonNullable<(typeof config)['source']>,
  ) => {
    const name =
      which === 'source' ? 'source_location_id' : 'destination_location_id';
    return (
      <Field name={name} label={fieldConfig.label} error={errors[name]?.message}>
        <select
          {...props(name)}
          className={selectClass}
          disabled={locations.loading}
          {...register(name)}
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
    );
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={handleSubmit(save)}
        noValidate
        className="max-w-3xl space-y-6 rounded-xl border bg-card p-5 sm:p-7"
      >
        <fieldset disabled={isSubmitting} className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {config.source && locationSelect('source', config.source)}
            {config.destination && locationSelect('destination', config.destination)}
            {config.partner && (
              <Field
                name="partner_name"
                label={config.partner.label}
                error={errors.partner_name?.message}
              >
                <Input
                  {...props('partner_name')}
                  placeholder={config.partner.placeholder}
                  autoComplete="off"
                  {...register('partner_name')}
                />
              </Field>
            )}
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
                lineKind={config.lineKind}
                availabilityLocationId={
                  config.sourceAvailability ? sourceLocationId : undefined
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
