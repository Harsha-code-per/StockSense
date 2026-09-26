// Owner: Member 3. Operation status badge.
// Convention (docs/ARCHITECTURE §6):
// Draft gray · Waiting amber · Ready blue · Done green · Canceled red.

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OperationStatus } from '@/lib/types';

const STATUS_STYLES: Record<OperationStatus, string> = {
  draft: 'border-gray-300 bg-gray-100 text-gray-700',
  waiting: 'border-amber-300 bg-amber-100 text-amber-800',
  ready: 'border-blue-300 bg-blue-100 text-blue-800',
  done: 'border-green-300 bg-green-100 text-green-800',
  canceled: 'border-red-300 bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<OperationStatus, string> = {
  draft: 'Draft',
  waiting: 'Waiting',
  ready: 'Ready',
  done: 'Done',
  canceled: 'Canceled',
};

export function StatusBadge({
  status,
  className,
}: {
  status: OperationStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
