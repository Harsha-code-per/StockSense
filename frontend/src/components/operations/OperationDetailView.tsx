// Owner: Member 3. Shared operation detail view — view lines and run the
// lifecycle (confirm → validate → done, or cancel). Backend responses drive
// the UI. Field labels follow the per-type contract (docs/API.md).

'use client';

import Link from 'next/link';

import type { Operation, OperationType } from '@/lib/types';
import {
  TYPE_LABELS,
  TYPE_ROUTES,
} from '@/lib/operations';
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

const TYPE_META: Record<
  'receipt' | 'delivery',
  { listLabel: string; locationLabel: string; partnerLabel: string }
> = {
  receipt: {
    listLabel: 'Receipts',
    locationLabel: 'Destination',
    partnerLabel: 'Vendor',
  },
  delivery: {
    listLabel: 'Deliveries',
    locationLabel: 'Source',
    partnerLabel: 'Customer',
  },
};

export function OperationDetailView({
  type,
  id,
}: {
  type: OperationType;
  id: string;
}) {
  const label = TYPE_LABELS[type];
  const metaLabels = TYPE_META[type as 'receipt' | 'delivery'];
  const listPath = TYPE_ROUTES[type];
  const operation = useApi<Operation>(`/api/operations/${id}`);

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
  const location =
    type === 'receipt' ? op.destination_location : op.source_location;
  const showAvailable =
    op.type !== 'receipt' && op.type !== 'adjustment' && op.status !== 'done';

  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={listPath}
              className="underline-offset-4 hover:text-primary hover:underline"
            >
              {metaLabels.listLabel}
            </Link>
            {' / '}
            {op.reference}
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {op.reference}
            <StatusBadge status={op.status} />
          </h1>
        </div>
        <OperationActions operation={op} onChanged={() => operation.reload()} />
      </div>

      <section
        aria-label={`${label} details`}
        className="mb-6 rounded-xl border bg-card p-5 sm:p-7"
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {meta(metaLabels.locationLabel, location?.full_name ?? '—')}
          {meta(metaLabels.partnerLabel, op.partner_name ?? '—')}
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
                <TableHead className="text-right">Quantity</TableHead>
                {showAvailable && (
                  <TableHead className="pr-5 text-right">Available</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {op.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="py-4 pl-5">
                    <div className="font-medium">{line.product_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {line.sku}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.quantity ?? line.counted_quantity}{' '}
                    <span className="text-muted-foreground">{line.uom}</span>
                  </TableCell>
                  {showAvailable && (
                    <TableCell className="pr-5 text-right tabular-nums text-muted-foreground">
                      {line.available != null
                        ? `${line.available} ${line.uom}`
                        : '—'}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="mt-6">
        <Button variant="outline" asChild>
          <Link href={listPath}>Back to {metaLabels.listLabel.toLowerCase()}</Link>
        </Button>
      </div>
    </>
  );
}
