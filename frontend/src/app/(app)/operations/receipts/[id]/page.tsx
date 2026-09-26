// Owner: Member 3. Receipt detail — view lines and run the lifecycle
// (confirm → validate → done, or cancel). Backend responses drive the UI.

'use client';

import { use } from 'react';
import Link from 'next/link';

import type { Operation } from '@/lib/types';
import { TYPE_ROUTES } from '@/lib/operations';
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
import { StatusBadge } from '@/components/operations/StatusBadge';
import { OperationActions } from '@/components/operations/OperationActions';

function meta(label: string, value: string) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

export default function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const receipt = useApi<Operation>(`/api/operations/${id}`);

  if (receipt.loading || receipt.error || !receipt.data) {
    return (
      <DataState
        loading={receipt.loading}
        error={receipt.error}
        retry={receipt.reload}
        empty="Receipt not found."
      />
    );
  }
  const op = receipt.data;

  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={TYPE_ROUTES.receipt}
              className="underline-offset-4 hover:text-primary hover:underline"
            >
              Receipts
            </Link>
            {' / '}
            {op.reference}
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {op.reference}
            <StatusBadge status={op.status} />
          </h1>
        </div>
        <OperationActions operation={op} onChanged={() => receipt.reload()} />
      </div>

      <section
        aria-label="Receipt details"
        className="mb-6 rounded-xl border bg-card p-5 sm:p-7"
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {meta('Destination', op.destination_location?.full_name ?? '—')}
          {meta('Vendor', op.partner_name ?? '—')}
          {meta('Scheduled date', op.scheduled_date ?? '—')}
          {meta('Created by', op.created_by.name)}
          {meta('Created at', op.created_at.slice(0, 10))}
          {meta('Validated by', op.validated_by?.name ?? '—')}
          {meta('Validated at', op.validated_at?.slice(0, 10) ?? '—')}
          {meta('Notes', op.notes ?? '—')}
        </dl>
      </section>

      <section
        aria-label="Receipt lines"
        className="min-w-0 overflow-hidden rounded-xl border bg-card"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Product</TableHead>
                <TableHead className="pr-5 text-right">Quantity</TableHead>
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
                  <TableCell className="pr-5 text-right tabular-nums">
                    {line.quantity}{' '}
                    <span className="text-muted-foreground">{line.uom}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="mt-6">
        <Button variant="outline" asChild>
          <Link href={TYPE_ROUTES.receipt}>Back to receipts</Link>
        </Button>
      </div>
    </>
  );
}
