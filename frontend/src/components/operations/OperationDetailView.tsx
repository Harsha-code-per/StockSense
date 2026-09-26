// Owner: Member 3. Shared operation detail view — view lines and run the
// lifecycle (confirm → validate → done, or cancel). Backend responses drive
// the UI. Field labels follow the per-type contract (docs/API.md).

'use client';

import Link from 'next/link';

import type { Operation, OperationType, User } from '@/lib/types';
import { TYPE_LABELS, TYPE_ROUTES } from '@/lib/operations';
import { useApi } from '@/components/ui/useApi';
import { DataState } from '@/components/ui/DataState';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from './StatusBadge';
import { OperationActions } from './OperationActions';

function meta(label: string, value: string) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

/** Location/partner meta rows per operation type */
function locationMeta(op: Operation): [string, string][] {
  switch (op.type) {
    case 'receipt':
      return [
        ['Destination', op.destination_location?.full_name ?? '—'],
        ['Vendor', op.partner_name ?? '—'],
      ];
    case 'delivery':
      return [
        ['Source', op.source_location?.full_name ?? '—'],
        ['Customer', op.partner_name ?? '—'],
      ];
    case 'transfer':
      return [
        ['Source', op.source_location?.full_name ?? '—'],
        ['Destination', op.destination_location?.full_name ?? '—'],
      ];
    case 'adjustment':
      return [['Counted location', op.source_location?.full_name ?? '—']];
  }
}

export function OperationDetailView({
  type,
  id,
}: {
  type: OperationType;
  id: string;
}) {
  const label = TYPE_LABELS[type];
  const listPath = TYPE_ROUTES[type];
  const operation = useApi<Operation>(`/api/operations/${id}`);
  const user = useApi<User>('/api/auth/me');

  if (operation.loading || operation.error || !operation.data) {
    return (
      <DataState
        loading={operation.loading}
        error={operation.error}
        retry={operation.reload}
        empty={`${label} not found.`}
      />
    );
  }
  const op = operation.data;
  const isAdjustment = op.type === 'adjustment';
  // Availability is only meaningful pre-validation for stock-out types.
  const showAvailable =
    (op.type === 'delivery' || op.type === 'transfer') && op.status !== 'done';
  // Adjustments validating is manager-only (backend enforces); the hint is UX.
  const validateDisabledReason =
    isAdjustment && user.data?.role === 'staff'
      ? 'Only a manager can validate an adjustment.'
      : undefined;

  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={listPath}
              className="underline-offset-4 hover:text-primary hover:underline"
            >
              {`${label}s`}
            </Link>
            {' / '}
            {op.reference}
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {op.reference}
            <StatusBadge status={op.status} />
          </h1>
        </div>
        <OperationActions
          operation={op}
          onChanged={() => operation.reload()}
          validateDisabledReason={validateDisabledReason}
        />
      </div>

      <section
        aria-label={`${label} details`}
        className="mb-6 rounded-xl border bg-card p-5 sm:p-7"
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {locationMeta(op).map(([labelText, value]) => (
            <div key={labelText}>
              <dt className="text-xs text-muted-foreground">{labelText}</dt>
              <dd className="mt-0.5 text-sm font-medium">{value}</dd>
            </div>
          ))}
          {meta('Scheduled date', op.scheduled_date ?? '—')}
          {meta('Created by', op.created_by.name)}
          {meta('Created at', op.created_at.slice(0, 10))}
          {meta('Validated by', op.validated_by?.name ?? '—')}
          {meta('Validated at', op.validated_at?.slice(0, 10) ?? '—')}
          {meta('Notes', op.notes ?? '—')}
        </dl>
      </section>

      <section
        aria-label={`${label} lines`}
        className="min-w-0 overflow-hidden rounded-xl border bg-card"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Product</TableHead>
                <TableHead className="text-right">
                  {isAdjustment ? 'Counted' : 'Quantity'}
                </TableHead>
                {isAdjustment && (
                  <>
                    <TableHead className="text-right">System</TableHead>
                    <TableHead
                      className={
                        showAvailable ? 'text-right' : 'pr-5 text-right'
                      }
                    >
                      Difference
                    </TableHead>
                  </>
                )}
                {showAvailable && (
                  <TableHead className="pr-5 text-right">Available</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {op.lines.map((line) => {
                // Difference preview from backend-reported fields only.
                const delta =
                  isAdjustment &&
                  line.counted_quantity != null &&
                  line.system_quantity != null
                    ? Number(line.counted_quantity) -
                      Number(line.system_quantity)
                    : null;
                return (
                  <TableRow key={line.id}>
                    <TableCell className="py-4 pl-5">
                      <div className="font-medium">{line.product_name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {line.sku}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {isAdjustment ? line.counted_quantity : line.quantity}{' '}
                      <span className="text-muted-foreground">{line.uom}</span>
                    </TableCell>
                    {isAdjustment && (
                      <>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {line.system_quantity ?? line.available ?? '—'}
                        </TableCell>
                        <TableCell
                          className={`tabular-nums text-right ${
                            showAvailable ? '' : 'pr-5 '
                          }${
                            delta != null && delta !== 0
                              ? delta < 0
                                ? 'text-red-600'
                                : 'text-green-600'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {delta != null
                            ? `${delta > 0 ? '+' : ''}${delta.toFixed(3)}`
                            : '—'}
                        </TableCell>
                      </>
                    )}
                    {showAvailable && (
                      <TableCell className="pr-5 text-right tabular-nums text-muted-foreground">
                        {line.available != null
                          ? `${line.available} ${line.uom}`
                          : '—'}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="mt-6">
        <Button variant="outline" asChild>
          <Link href={listPath}>Back to {`${label.toLowerCase()}s`}</Link>
        </Button>
      </div>
    </>
  );
}
