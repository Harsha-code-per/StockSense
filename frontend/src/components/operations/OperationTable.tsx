// Owner: Member 3. Shared operations list table (real backend data only).
// Renders OperationSummary rows from GET /api/operations — no invented fields.

import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { OperationSummary, OperationType } from '@/lib/types';
import { TYPE_ROUTES } from '@/lib/operations';
import { StatusBadge } from './StatusBadge';

function locationLabel(op: OperationSummary): string {
  const parts: string[] = [];
  if (op.source_location) parts.push(op.source_location.full_name);
  if (op.destination_location) parts.push(op.destination_location.full_name);
  return parts.join(' → ') || '—';
}

export function OperationTable({
  items,
  type,
}: {
  items: OperationSummary[];
  type: OperationType;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Reference</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Partner</TableHead>
            <TableHead>Locations</TableHead>
            <TableHead>Scheduled</TableHead>
            <TableHead className="text-right">Lines</TableHead>
            <TableHead className="pr-5 text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((op) => (
            <TableRow key={op.id}>
              <TableCell className="py-4 pl-5">
                <Link
                  href={`${TYPE_ROUTES[type]}/${op.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {op.reference}
                </Link>
              </TableCell>
              <TableCell>
                <StatusBadge status={op.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {op.partner_name ?? '—'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {locationLabel(op)}
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {op.scheduled_date ?? '—'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {op.line_count}
              </TableCell>
              <TableCell className="pr-5 text-right tabular-nums text-muted-foreground">
                {op.created_at.slice(0, 10)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
