// Owner: Member 3. Typed wrappers for the operations endpoints.
// Contract: docs/API.md (relative /api URLs via @/lib/api, types from @/lib/types).

import { api } from '@/lib/api';
import type {
  AvailableStock,
  Operation,
  OperationCreate,
  OperationStatus,
  OperationSummary,
  OperationType,
  OperationUpdate,
  Page,
  ValidateResult,
} from '@/lib/types';

export interface OperationsQuery {
  type?: OperationType;
  status?: OperationStatus[];
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export function operationsQueryString(q: OperationsQuery): string {
  const params = new URLSearchParams();
  if (q.type) params.set('type', q.type);
  if (q.status?.length) params.set('status', q.status.join(','));
  if (q.search) params.set('search', q.search);
  if (q.date_from) params.set('date_from', q.date_from);
  if (q.date_to) params.set('date_to', q.date_to);
  params.set('page', String(q.page ?? 1));
  params.set('page_size', String(q.page_size ?? 20));
  return params.toString();
}

export function listOperations(
  q: OperationsQuery,
  signal?: AbortSignal,
): Promise<Page<OperationSummary>> {
  return api(`/api/operations?${operationsQueryString(q)}`, { signal });
}

export function getOperation(id: number, signal?: AbortSignal): Promise<Operation> {
  return api(`/api/operations/${id}`, { signal });
}

export function createOperation(body: OperationCreate): Promise<Operation> {
  return api('/api/operations', { method: 'POST', body: JSON.stringify(body) });
}

export function updateOperation(
  id: number,
  body: OperationUpdate,
): Promise<Operation> {
  return api(`/api/operations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function confirmOperation(id: number): Promise<Operation> {
  return api(`/api/operations/${id}/confirm`, { method: 'POST' });
}

export function validateOperation(id: number): Promise<ValidateResult> {
  return api(`/api/operations/${id}/validate`, { method: 'POST' });
}

export function cancelOperation(id: number): Promise<Operation> {
  return api(`/api/operations/${id}/cancel`, { method: 'POST' });
}

export function getAvailable(
  productId: number,
  locationId: number,
  signal?: AbortSignal,
): Promise<AvailableStock> {
  return api(
    `/api/inventory/available?product_id=${productId}&location_id=${locationId}`,
    { signal },
  );
}

/** Route segment for each operation type, e.g. receipt -> /operations/receipts */
export const TYPE_ROUTES: Record<OperationType, string> = {
  receipt: '/operations/receipts',
  delivery: '/operations/deliveries',
  transfer: '/operations/transfers',
  adjustment: '/operations/adjustments',
};

export const TYPE_LABELS: Record<OperationType, string> = {
  receipt: 'Receipt',
  delivery: 'Delivery',
  transfer: 'Transfer',
  adjustment: 'Adjustment',
};

export const OPERATION_STATUSES: OperationStatus[] = [
  'draft',
  'waiting',
  'ready',
  'done',
  'canceled',
];
