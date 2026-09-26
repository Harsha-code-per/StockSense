'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import type {
  Category,
  Location,
  Product,
  ProductCreate,
  User,
} from '@/lib/types';
import { useApi } from '@/components/ui/useApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, selectClass } from '@/components/ui/Field';
import { DataState } from '@/components/ui/DataState';
import { formErrors } from '@/components/ui/formErrors';

const quantity = z
  .string()
  .trim()
  .regex(
    /^\d{1,15}(\.\d{1,3})?$/,
    'Enter a non-negative quantity with up to 3 decimal places.',
  );
const schema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(1, 'Enter a SKU.')
      .max(40)
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
        'Use letters, numbers, hyphens, or underscores.',
      ),
    name: z.string().trim().min(1, 'Enter a product name.').max(160),
    category_id: z.string(),
    uom: z.enum(['unit', 'kg', 'g', 'l', 'ml', 'm', 'box']),
    min_qty: quantity,
    max_qty: quantity,
    description: z.string().trim().max(2000),
    is_active: z.boolean(),
    initial_quantity: quantity,
    initial_location_id: z.string(),
  })
  .refine(
    (values) =>
      !/[1-9]/.test(values.initial_quantity) || !!values.initial_location_id,
    {
      path: ['initial_location_id'],
      message: 'Choose a location for opening stock.',
    },
  );
type Values = z.infer<typeof schema>;
const fields = [
  'sku',
  'name',
  'category_id',
  'uom',
  'min_qty',
  'max_qty',
  'description',
  'is_active',
  'initial_quantity',
  'initial_location_id',
] as const;
export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const categories = useApi<Category[]>('/api/categories');
  const locations = useApi<Location[]>('/api/locations?is_active=true');
  const user = useApi<User>('/api/auth/me');
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: product?.sku ?? '',
      name: product?.name ?? '',
      category_id: product?.category ? String(product.category.id) : '',
      uom: product?.uom ?? 'unit',
      min_qty: product?.min_qty ?? '0',
      max_qty: product?.max_qty ?? '0',
      description: product?.description ?? '',
      is_active: product?.is_active ?? true,
      initial_quantity: '0',
      initial_location_id: '',
    },
  });
  async function save(values: Values) {
    const body: ProductCreate & { is_active?: boolean } = {
      sku: values.sku,
      name: values.name,
      category_id: values.category_id ? Number(values.category_id) : null,
      uom: values.uom,
      min_qty: values.min_qty,
      max_qty: values.max_qty,
      description: values.description || null,
    };
    if (product) body.is_active = values.is_active;
    else {
      body.initial_quantity = values.initial_quantity;
      body.initial_location_id = values.initial_location_id
        ? Number(values.initial_location_id)
        : null;
    }
    try {
      const saved = await api<Product>(
        product ? `/api/products/${product.id}` : '/api/products',
        { method: product ? 'PATCH' : 'POST', body: JSON.stringify(body) },
      );
      toast.success(`${saved.name} ${product ? 'updated' : 'created'}.`);
      router.push(`/products/${saved.id}`);
    } catch (error) {
      formErrors(error, setError, fields);
    }
  }
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  // categories.reload() is async and the freshly created category isn't a
  // valid <option> yet when it resolves; wait for it to actually appear in
  // the reloaded list before selecting it, or the native <select> ignores
  // the value. A ref (not state) holds the pending id since it's imperative
  // bookkeeping, not something the UI needs to re-render on its own.
  const pendingCategoryIdRef = useRef<string | null>(null);
  useEffect(() => {
    const pendingId = pendingCategoryIdRef.current;
    if (pendingId && categories.data?.some((c) => String(c.id) === pendingId)) {
      setValue('category_id', pendingId);
      pendingCategoryIdRef.current = null;
    }
  }, [categories.data, setValue]);
  async function createCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setCategoryError('Enter a category name.');
      return;
    }
    setCategorySubmitting(true);
    setCategoryError(null);
    try {
      const created = await api<Category>('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      pendingCategoryIdRef.current = String(created.id);
      categories.reload();
      setCreatingCategory(false);
      setNewCategoryName('');
      toast.success(`${created.name} added.`);
    } catch (error) {
      setCategoryError(
        error instanceof Error
          ? error.message
          : 'Unable to create category. Please try again.',
      );
    } finally {
      setCategorySubmitting(false);
    }
  }
  if (user.loading || user.error)
    return (
      <DataState
        loading={user.loading}
        error={user.error}
        retry={user.reload}
      />
    );
  if (user.data?.role !== 'manager')
    return (
      <p role="status" className="rounded-xl border bg-card p-8">
        Only managers can change product details.
      </p>
    );
  const props = (name: keyof Values) => ({
    id: name,
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });
  return (
    <form
      onSubmit={handleSubmit(save)}
      noValidate
      className="max-w-3xl rounded-xl border bg-card p-5 sm:p-7"
    >
      <fieldset disabled={isSubmitting} className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="sku" label="SKU" error={errors.sku?.message}>
            <Input {...props('sku')} autoComplete="off" {...register('sku')} />
          </Field>
          <Field name="name" label="Product name" error={errors.name?.message}>
            <Input {...props('name')} {...register('name')} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="category_id"
            label="Category"
            error={errors.category_id?.message}
          >
            <select
              {...props('category_id')}
              className={selectClass}
              disabled={categories.loading || !!categories.error}
              {...register('category_id')}
            >
              <option value="">Uncategorized</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {creatingCategory ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="New category name"
                    value={newCategoryName}
                    onChange={(event) => {
                      setNewCategoryName(event.target.value);
                      if (categoryError) setCategoryError(null);
                    }}
                    disabled={categorySubmitting}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={createCategory}
                    disabled={categorySubmitting}
                  >
                    {categorySubmitting ? 'Creating…' : 'Create'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={categorySubmitting}
                    onClick={() => {
                      setCreatingCategory(false);
                      setNewCategoryName('');
                      setCategoryError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                {categoryError && (
                  <p role="alert" className="text-sm text-destructive">
                    {categoryError}
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingCategory(true)}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                New category
              </button>
            )}
          </Field>
          <Field name="uom" label="Unit of measure" error={errors.uom?.message}>
            <select
              {...props('uom')}
              className={selectClass}
              {...register('uom')}
            >
              {['unit', 'kg', 'g', 'l', 'ml', 'm', 'box'].map((uom) => (
                <option key={uom} value={uom}>
                  {uom}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {categories.error && (
          <DataState error={categories.error} retry={categories.reload} />
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="min_qty"
            label="Minimum quantity"
            error={errors.min_qty?.message}
          >
            <Input
              {...props('min_qty')}
              inputMode="decimal"
              {...register('min_qty')}
            />
          </Field>
          <Field
            name="max_qty"
            label="Maximum quantity"
            error={errors.max_qty?.message}
          >
            <Input
              {...props('max_qty')}
              inputMode="decimal"
              {...register('max_qty')}
            />
          </Field>
        </div>
        <p className="text-sm text-muted-foreground">
          Stock levels and suggested orders are calculated by the inventory
          service.
        </p>
        <Field
          name="description"
          label="Description"
          error={errors.description?.message}
        >
          <Textarea
            {...props('description')}
            rows={4}
            {...register('description')}
          />
        </Field>
        {product ? (
          <Field
            name="is_active"
            label="Active product"
            error={errors.is_active?.message}
          >
            <input
              {...props('is_active')}
              type="checkbox"
              className="size-5 accent-primary"
              {...register('is_active')}
            />
            <p className="text-sm text-muted-foreground">
              Inactive products remain in stock history.
            </p>
          </Field>
        ) : (
          <div className="space-y-4 border-t pt-5">
            <h2 className="font-medium">Opening stock</h2>
            <p className="text-sm text-muted-foreground">
              Optional. Enter the opening count at one location. The inventory
              service records the movement.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                name="initial_quantity"
                label="Opening quantity"
                error={errors.initial_quantity?.message}
              >
                <Input
                  {...props('initial_quantity')}
                  inputMode="decimal"
                  {...register('initial_quantity')}
                />
              </Field>
              <Field
                name="initial_location_id"
                label="Opening location"
                error={errors.initial_location_id?.message}
              >
                <select
                  {...props('initial_location_id')}
                  className={selectClass}
                  disabled={locations.loading || !!locations.error}
                  {...register('initial_location_id')}
                >
                  <option value="">Choose a location</option>
                  {locations.data?.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.full_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {locations.error && (
              <DataState error={locations.error} retry={locations.reload} />
            )}
          </div>
        )}
        {errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}
        <div className="flex flex-wrap gap-3 border-t pt-5">
          <Button
            type="submit"
            disabled={isSubmitting || categories.loading || !!categories.error}
          >
            {isSubmitting
              ? 'Saving…'
              : product
                ? 'Save changes'
                : 'Create product'}
          </Button>
          <Button variant="outline" asChild>
            <Link href={product ? `/products/${product.id}` : '/products'}>
              Cancel
            </Link>
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
