// Owner: Member 3. Editable lines table for operation forms.
// Real-product selects (fed from GET /api/products by the parent form — one fetch,
// no per-line refetch), quantity or counted-quantity entry, duplicate-product
// prevention both in the option lists (UI) and in the form schema (final validation).
// When availabilityLocationId is set, each line shows the backend-reported
// availability at that location; on adjustment lines it doubles as the
// "system" quantity for a display-only difference preview (counted − system).
// The frontend never treats these values as authoritative inventory.

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
    amount: line?.quantity?.message ?? line?.counted_quantity?.message,
  };
}

interface AvailabilityState {
  key: string;
  quantity?: string;
  failed?: boolean;
}

// Backend-reported availability for a (product, location) pair. Fetches only
// when both are chosen; keyed state means a stale response for an old
// selection is never rendered against the new one.
function useAvailability(
  productId: string,
  locationId: string,
): AvailabilityState | null {
  const key = productId && locationId ? `${productId}:${locationId}` : null;
  const [state, setState] = useState<AvailabilityState | null>(null);

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

  if (!key || !state || state.key !== key) return null;
  return state;
}

function AvailabilityValue({
  state,
  uom,
}: {
  state: AvailabilityState | null;
  uom: string;
}) {
  if (!state) return <span className="text-muted-foreground">…</span>;
  if (state.failed) return <span className="text-destructive">Unavailable</span>;
  return (
    <span className="tabular-nums">
      {state.quantity} {uom}
    </span>
  );
}

export function LineEditor({
  products,
  lineKind = 'quantity',
  availabilityLocationId,
}: {
  products: Product[];
  /** 'counted' for adjustments (counted_quantity), else 'quantity' */
  lineKind?: 'quantity' | 'counted';
  /** When set: show backend availability at this location per line */
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
  const isCounted = lineKind === 'counted';

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b text-left">
              <th className="min-w-56 px-3 py-2 font-medium">Product</th>
              {isCounted && (
                <th className="w-32 px-3 py-2 text-right font-medium">
                  System
                </th>
              )}
              <th className="w-40 px-3 py-2 text-right font-medium">
                {isCounted ? 'Counted' : 'Quantity'}
              </th>
              {isCounted && (
                <th className="w-28 px-3 py-2 text-right font-medium">
                  Difference
                </th>
              )}
              {!isCounted && availabilityLocationId !== undefined && (
                <th className="w-32 px-3 py-2 text-right font-medium">
                  Available
                </th>
              )}
              <th className="w-14 px-3 py-2" aria-label="Remove line" />
            </tr>
          </thead>
          <tbody className="[&_tr:not(:last-child)]:border-b">
            {fields.map((field, index) => (
              <LineRow
                key={field.id}
                index={index}
                products={products}
                lines={lines}
                chosenIds={chosenIds}
                register={register}
                errors={errors}
                isCounted={isCounted}
                availabilityLocationId={availabilityLocationId}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
              />
            ))}
          </tbody>
        </table>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          append({ product_id: '', quantity: '', counted_quantity: '' })
        }
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

function LineRow({
  index,
  products,
  lines,
  chosenIds,
  register,
  errors,
  isCounted,
  availabilityLocationId,
  onRemove,
  canRemove,
}: {
  index: number;
  products: Product[];
  lines: OperationFormValues['lines'];
  chosenIds: string[];
  register: ReturnType<typeof useFormContext<OperationFormValues>>['register'];
  errors: FieldErrors<OperationFormValues>;
  isCounted: boolean;
  availabilityLocationId?: string;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const error = lineError(errors, index);
  const productName = `lines.${index}.product_id` as const;
  const amountName = isCounted
    ? (`lines.${index}.counted_quantity` as const)
    : (`lines.${index}.quantity` as const);
  const currentId = lines[index]?.product_id;
  const current = products.find((p) => String(p.id) === currentId);

  // Only query/display availability once a location is actually chosen —
  // never show a loading spinner for a pair that cannot be asked yet.
  const showAvailability =
    availabilityLocationId !== undefined && availabilityLocationId !== '';
  const availability = useAvailability(
    currentId ?? '',
    availabilityLocationId ?? '',
  );

  // Display-only preview for adjustments: counted − system, using the
  // backend-reported system quantity. Not authoritative inventory math.
  const countedValue = lines[index]?.counted_quantity?.trim();
  const systemValue =
    availability && !availability.failed ? availability.quantity : undefined;
  let difference: string | null = null;
  if (
    isCounted &&
    systemValue != null &&
    countedValue &&
    /^\d{1,15}(\.\d{1,3})?$/.test(countedValue)
  ) {
    const delta = Number(countedValue) - Number(systemValue);
    difference = `${delta > 0 ? '+' : ''}${delta.toFixed(3)}`;
  }

  return (
    <tr className="align-top">
      <td className="px-3 py-2">
        <Label htmlFor={productName} className="sr-only">
          Product for line {index + 1}
        </Label>
        <select
          id={productName}
          className={selectClass}
          aria-invalid={!!error.product}
          aria-describedby={error.product ? `${productName}-error` : undefined}
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
      {isCounted && (
        <td className="px-3 py-2 pt-4 text-right">
          {currentId && showAvailability ? (
            <AvailabilityValue state={availability} uom={current?.uom ?? ''} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}
      <td className="px-3 py-2">
        <Label htmlFor={amountName} className="sr-only">
          {isCounted ? 'Counted quantity' : 'Quantity'} for line {index + 1}
        </Label>
        <Input
          id={amountName}
          inputMode="decimal"
          placeholder="0.000"
          className="text-right tabular-nums"
          aria-invalid={!!error.amount}
          aria-describedby={error.amount ? `${amountName}-error` : undefined}
          {...register(amountName)}
        />
        {error.amount && (
          <p
            id={`${amountName}-error`}
            role="alert"
            className="mt-1 text-sm text-destructive"
          >
            {error.amount}
          </p>
        )}
      </td>
      {isCounted && (
        <td className="px-3 py-2 pt-4 text-right tabular-nums">
          <span
            className={
              difference != null && Number(difference) !== 0
                ? Number(difference) < 0
                  ? 'text-red-600'
                  : 'text-green-600'
                : 'text-muted-foreground'
            }
          >
            {difference ?? '—'}
          </span>
        </td>
      )}
      {!isCounted && showAvailability && (
        <td className="px-3 py-2 pt-4 text-right">
          {currentId ? (
            <AvailabilityValue state={availability} uom={current?.uom ?? ''} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}
      <td className="px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove line ${index + 1}`}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </td>
    </tr>
  );
}
