// Owner: Member 3. Editable lines table for operation forms.
// Real-product selects (fed from GET /api/products by the parent form — one fetch,
// no per-line refetch), quantity entry, duplicate-product prevention both in the
// option lists (UI) and in the form schema (final validation).

'use client';

import { useEffect, useState } from 'react';
import {
  useFieldArray,
  useFormContext,
  type FieldErrors,
} from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { selectClass } from '@/components/ui/Field';
import type { Product } from '@/lib/types';
import { getAvailable } from '@/lib/operations';
import type { OperationFormValues } from './OperationForm';

function lineError(errors: FieldErrors<OperationFormValues>, index: number) {
  const line = errors.lines?.[index];
  return {
    product: line?.product_id?.message,
    quantity: line?.quantity?.message,
  };
}

// Backend-reported availability for one line. Fetches only when both product
// and source location are chosen; keyed state means a stale response for an
// old selection is never rendered against the new one.
function AvailabilityCell({
  productId,
  locationId,
  uom,
}: {
  productId: string;
  locationId: string;
  uom: string;
}) {
  const key = productId && locationId ? `${productId}:${locationId}` : null;
  const [state, setState] = useState<{
    key: string;
    quantity?: string;
    failed?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!key) return;
    const [p, l] = key.split(':');
    const controller = new AbortController();
    getAvailable(Number(p), Number(l), controller.signal).then(
      (stock) => setState({ key, quantity: stock.quantity }),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        setState({ key, failed: true });
      },
    );
    return () => controller.abort();
  }, [key]);

  if (!key) return <span className="text-muted-foreground">—</span>;
  if (!state || state.key !== key)
    return <span className="text-muted-foreground">…</span>;
  if (state.failed)
    return <span className="text-destructive">Unavailable</span>;
  return (
    <span className="tabular-nums">
      {state.quantity} {uom}
    </span>
  );
}

export function LineEditor({
  products,
  availabilityLocationId,
}: {
  products: Product[];
  /** When set (deliveries): show "Available: N uom" per line from the API */
  availabilityLocationId?: string;
}) {
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<OperationFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const lines = watch('lines');
  const chosenIds = lines
    .map((line) => line.product_id)
    .filter((id) => id !== '');

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b text-left">
              <th className="min-w-56 px-3 py-2 font-medium">Product</th>
              <th className="w-40 px-3 py-2 text-right font-medium">
                Quantity
              </th>
              {availabilityLocationId !== undefined && (
                <th className="w-32 px-3 py-2 text-right font-medium">
                  Available
                </th>
              )}
              <th className="w-14 px-3 py-2" aria-label="Remove line" />
            </tr>
          </thead>
          <tbody className="[&_tr:not(:last-child)]:border-b">
            {fields.map((field, index) => {
              const error = lineError(errors, index);
              const productName = `lines.${index}.product_id` as const;
              const quantityName = `lines.${index}.quantity` as const;
              const currentId = lines[index]?.product_id;
              const current = products.find(
                (product) => String(product.id) === currentId,
              );
              return (
                <tr key={field.id} className="align-top">
                  <td className="px-3 py-2">
                    <Label htmlFor={productName} className="sr-only">
                      Product for line {index + 1}
                    </Label>
                    <select
                      id={productName}
                      className={selectClass}
                      aria-invalid={!!error.product}
                      aria-describedby={
                        error.product ? `${productName}-error` : undefined
                      }
                      {...register(productName)}
                    >
                      <option value="">Choose a product</option>
                      {products.map((product) => (
                        <option
                          key={product.id}
                          value={product.id}
                          disabled={
                            chosenIds.includes(String(product.id)) &&
                            String(product.id) !== currentId
                          }
                        >
                          {product.sku} — {product.name}
                        </option>
                      ))}
                    </select>
                    {error.product && (
                      <p
                        id={`${productName}-error`}
                        role="alert"
                        className="mt-1 text-sm text-destructive"
                      >
                        {error.product}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Label htmlFor={quantityName} className="sr-only">
                      Quantity for line {index + 1}
                    </Label>
                    <Input
                      id={quantityName}
                      inputMode="decimal"
                      placeholder="0.000"
                      className="text-right tabular-nums"
                      aria-invalid={!!error.quantity}
                      aria-describedby={
                        error.quantity ? `${quantityName}-error` : undefined
                      }
                      aria-label={`Quantity${current ? ` (${current.uom})` : ''}`}
                      {...register(quantityName)}
                    />
                    {error.quantity && (
                      <p
                        id={`${quantityName}-error`}
                        role="alert"
                        className="mt-1 text-sm text-destructive"
                      >
                        {error.quantity}
                      </p>
                    )}
                  </td>
                  {availabilityLocationId !== undefined && (
                    <td className="px-3 py-2 pt-4 text-right">
                      <AvailabilityCell
                        productId={currentId ?? ''}
                        locationId={availabilityLocationId}
                        uom={current?.uom ?? ''}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      aria-label={`Remove line ${index + 1}`}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ product_id: '', quantity: '' })}
      >
        <Plus aria-hidden="true" /> Add line
      </Button>
      {errors.lines?.root?.message && (
        <p role="alert" className="text-sm text-destructive">
          {errors.lines.root.message}
        </p>
      )}
      {typeof errors.lines?.message === 'string' && (
        <p role="alert" className="text-sm text-destructive">
          {errors.lines.message}
        </p>
      )}
    </div>
  );
}
