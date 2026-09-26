// Owner: Member 3. Operation status badge.
// UI convention (ARCHITECTURE §6): Draft gray · Waiting amber · Ready blue ·
// Done green · Canceled red.

import { Badge } from "@/components/ui/badge";
import type { OperationStatus } from "@/lib/operations";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<OperationStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-300",
  waiting: "bg-amber-100 text-amber-800 border-amber-300",
  ready: "bg-blue-100 text-blue-800 border-blue-300",
  done: "bg-green-100 text-green-800 border-green-300",
  canceled: "bg-red-100 text-red-700 border-red-300",
};

const STATUS_LABELS: Record<OperationStatus, string> = {
  draft: "Draft",
  waiting: "Waiting",
  ready: "Ready",
  done: "Done",
  canceled: "Canceled",
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
