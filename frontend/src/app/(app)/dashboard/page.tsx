'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpFromLine,
  CheckCircle2,
  ClipboardList,
  Layers,
  PackageCheck,
  PackageX,
  RefreshCw,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StockBadge } from '@/components/ui/StockBadge';
import { DataState } from '@/components/ui/DataState';
import { selectClass } from '@/components/ui/Field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApi } from '@/components/ui/useApi';
import type {
  Category,
  DashboardSummary,
  OperationStatus,
  OperationSummary,
  OperationType,
  Page,
  Warehouse,
} from '@/lib/types';

interface CountPriorityItem {
  product_id: number;
  sku: string;
  product_name: string;
  uom: string;
  location_id: number;
  location_name: string;
  quantity: string | number;
  last_counted_at: string | null;
  days_since_count: number;
  movements_since_count: number;
  past_discrepancies: number;
  score: number;
  level: 'high' | 'medium' | 'low';
  reasons: string[];
  [key: string]: unknown;
}

const priorityLevelStyles: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-danger-soft text-danger border-destructive/20 font-semibold uppercase text-[10px] tracking-wider',
  medium: 'bg-warning-soft text-warning border-warning/20 font-semibold uppercase text-[10px] tracking-wider',
  low: 'bg-secondary text-secondary-foreground border-border font-medium uppercase text-[10px] tracking-wider',
};

const statusBadgeStyles: Record<OperationStatus, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  waiting: 'bg-warning-soft text-warning',
  ready: 'bg-info-soft text-info',
  done: 'bg-success-soft text-success',
  canceled: 'bg-muted text-muted-foreground line-through',
};

const statusLabels: Record<OperationStatus, string> = {
  draft: 'Draft',
  waiting: 'Waiting',
  ready: 'Ready',
  done: 'Done',
  canceled: 'Canceled',
};

const typeLabels: Record<OperationType, string> = {
  receipt: 'Receipt',
  delivery: 'Delivery',
  transfer: 'Transfer',
  adjustment: 'Adjustment',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function DashboardPage() {
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [operationType, setOperationType] = useState<string>('');
  const [operationStatus, setOperationStatus] = useState<string>('');

  const params = new URLSearchParams();
  if (warehouseId) params.set('warehouse_id', warehouseId);
  if (categoryId) params.set('category_id', categoryId);
  if (operationType) params.set('type', operationType);
  if (operationStatus) params.set('status', operationStatus);
  const queryString = params.toString();
  const summaryPath = `/api/dashboard/summary${queryString ? `?${queryString}` : ''}`;

  const summary = useApi<DashboardSummary>(summaryPath);
  const warehouses = useApi<Warehouse[]>('/api/warehouses?is_active=true');
  const categories = useApi<Category[]>('/api/categories');
  const countPriority = useApi<CountPriorityItem[] | { items: CountPriorityItem[] }>(
    '/api/inventory/count-priority?limit=5',
  );

  const opsParams = new URLSearchParams({ page: '1', page_size: '10' });
  if (warehouseId) opsParams.set('warehouse_id', warehouseId);
  if (categoryId) opsParams.set('category_id', categoryId);
  if (operationType) opsParams.set('type', operationType);
  if (operationStatus) opsParams.set('status', operationStatus);
  const operations = useApi<Page<OperationSummary>>(`/api/operations?${opsParams.toString()}`);

  const countItems: CountPriorityItem[] = Array.isArray(countPriority.data)
    ? countPriority.data
    : Array.isArray(countPriority.data?.items)
      ? countPriority.data.items
      : [];

  const hasFilters = Boolean(
    warehouseId || categoryId || operationType || operationStatus,
  );

  return (
    <div className="space-y-8">
      {/* Header with Ledger Reconciliation status */}
      <PageHeader
        title="Dashboard"
        description="Real-time overview of inventory stock levels, open operations, and ledger reconciliation."
      >
        <div className="flex flex-wrap items-center gap-3">
          {summary.data && (
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
                summary.data.ledger_ok
                  ? 'border border-success/30 bg-success-soft text-success'
                  : 'border border-destructive/30 bg-danger-soft text-destructive'
              }`}
              role="status"
              aria-label={
                summary.data.ledger_ok
                  ? 'Ledger reconciled'
                  : 'Ledger mismatch detected'
              }
            >
              {summary.data.ledger_ok ? (
                <>
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  <span>Ledger reconciled ✓</span>
                </>
              ) : (
                <>
                  <AlertCircle className="size-4" aria-hidden="true" />
                  <span>Ledger mismatch detected ⚠</span>
                </>
              )}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              summary.reload();
              countPriority.reload();
              operations.reload();
            }}
            className="gap-1.5"
            title="Refresh dashboard data"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            <span>Refresh</span>
          </Button>
        </div>
      </PageHeader>

      {/* Ledger Alert Banner when ledger_ok is false */}
      {summary.data && !summary.data.ledger_ok && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-danger-soft p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-semibold text-destructive">
                Ledger reconciliation issue detected
              </p>
              <p className="text-xs text-destructive/90 sm:text-sm">
                The cumulative sum of ledger transactions does not match one or more product balances.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="destructive" className="shrink-0 self-start sm:self-auto">
            <Link href="/history">Inspect Ledger</Link>
          </Button>
        </div>
      )}

      {/* Dynamic Filters Bar */}
      <section
        aria-label="Dashboard filters"
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">Filters:</span>
          </div>

          <div className="w-48">
            <label htmlFor="dashboard-warehouse" className="sr-only">
              Filter by warehouse
            </label>
            <select
              id="dashboard-warehouse"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={selectClass}
              disabled={warehouses.loading}
            >
              <option value="">All warehouses</option>
              {warehouses.data?.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </option>
              ))}
            </select>
          </div>

          <div className="w-48">
            <label htmlFor="dashboard-category" className="sr-only">
              Filter by category
            </label>
            <select
              id="dashboard-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={selectClass}
              disabled={categories.loading}
            >
              <option value="">All categories</option>
              {categories.data?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-40">
            <label htmlFor="dashboard-type" className="sr-only">
              Filter by operation type
            </label>
            <select
              id="dashboard-type"
              value={operationType}
              onChange={(e) => setOperationType(e.target.value)}
              className={selectClass}
            >
              <option value="">All types</option>
              <option value="receipt">Receipt</option>
              <option value="delivery">Delivery</option>
              <option value="transfer">Transfer</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </div>

          <div className="w-40">
            <label htmlFor="dashboard-status" className="sr-only">
              Filter by operation status
            </label>
            <select
              id="dashboard-status"
              value={operationStatus}
              onChange={(e) => setOperationStatus(e.target.value)}
              className={selectClass}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="waiting">Waiting</option>
              <option value="ready">Ready</option>
              <option value="done">Done</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>

          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setWarehouseId('');
                setCategoryId('');
                setOperationType('');
                setOperationStatus('');
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              Reset filters
            </Button>
          )}
        </div>

        {summary.data && (
          <p className="text-xs text-muted-foreground">
            {hasFilters ? 'Showing filtered summary' : 'All operations & stock'}
          </p>
        )}
      </section>

      {/* Main Content / Error / Loading States */}
      {summary.loading ? (
        <DataState loading />
      ) : summary.error ? (
        <DataState error={summary.error} retry={summary.reload} />
      ) : summary.data ? (
        <>
          {/* KPI Cards Grid */}
          <section aria-label="Inventory KPIs">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {/* Products in stock */}
              <Link
                href="/products?stock_status=in_stock"
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">In Stock</span>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-success-soft text-success transition-transform group-hover:scale-110">
                    <PackageCheck className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {summary.data.kpis.products_in_stock}
                  </span>
                  <p className="text-xs text-muted-foreground">Healthy stock lines</p>
                </div>
              </Link>

              {/* Low stock */}
              <Link
                href="/products?stock_status=low"
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-4 transition-all hover:border-warning/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Low Stock</span>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-warning-soft text-warning transition-transform group-hover:scale-110">
                    <AlertTriangle className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {summary.data.kpis.low_stock}
                  </span>
                  <p className="text-xs text-muted-foreground">Below reorder point</p>
                </div>
              </Link>

              {/* Out of stock */}
              <Link
                href="/products?stock_status=out"
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-4 transition-all hover:border-danger/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Out of Stock</span>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-danger-soft text-danger transition-transform group-hover:scale-110">
                    <PackageX className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {summary.data.kpis.out_of_stock}
                  </span>
                  <p className="text-xs text-muted-foreground">Zero balance</p>
                </div>
              </Link>

              {/* Pending receipts */}
              <Link
                href="/operations/receipts"
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Pending Receipts</span>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-info-soft text-info transition-transform group-hover:scale-110">
                    <ArrowDownToLine className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {summary.data.kpis.pending_receipts}
                  </span>
                  <p className="text-xs text-muted-foreground">Incoming shipments</p>
                </div>
              </Link>

              {/* Pending deliveries */}
              <Link
                href="/operations/deliveries"
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Pending Deliveries</span>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-transform group-hover:scale-110">
                    <ArrowUpFromLine className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {summary.data.kpis.pending_deliveries}
                  </span>
                  <p className="text-xs text-muted-foreground">Outgoing dispatches</p>
                </div>
              </Link>

              {/* Scheduled transfers */}
              <Link
                href="/operations/transfers"
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Transfers</span>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-transform group-hover:scale-110">
                    <ArrowLeftRight className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {summary.data.kpis.scheduled_transfers}
                  </span>
                  <p className="text-xs text-muted-foreground">Internal movements</p>
                </div>
              </Link>
            </div>
          </section>

          {/* Low Stock Items & Count Next Split Grid */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Low-Stock Section (2 cols on lg) */}
            <section
              aria-label="Low stock items"
              className="overflow-hidden rounded-xl border bg-card shadow-xs lg:col-span-2"
            >
              <div className="flex flex-wrap items-center justify-between border-b p-5">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    Low Stock Alerts
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Items that reached or fell below minimum threshold
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/products?stock_status=low" className="gap-1">
                    <span>View all products</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>

              {summary.data.low_stock_items.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  All products are currently stocked at safe levels. No low-stock alerts.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">On Hand</TableHead>
                        <TableHead className="text-right">Min Qty</TableHead>
                        <TableHead className="text-right">Suggested Order</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.data.low_stock_items.map((item) => (
                        <TableRow key={item.product_id}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/products/${item.product_id}`}
                              className="font-medium text-foreground hover:underline"
                            >
                              {item.name}
                            </Link>
                            <span className="block text-xs font-mono text-muted-foreground">
                              {item.sku}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StockBadge status={item.stock_status} />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {item.on_hand}{' '}
                            <span className="text-xs text-muted-foreground">{item.uom}</span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {item.min_qty}{' '}
                            <span className="text-xs text-muted-foreground">{item.uom}</span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                            {item.suggested_order}{' '}
                            <span className="text-xs text-muted-foreground">{item.uom}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="ghost" size="xs">
                              <Link href={`/products/${item.product_id}`}>Details</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            {/* Count Next Priority Card */}
            <section
              aria-label="Cycle count priorities"
              className="flex flex-col justify-between overflow-hidden rounded-xl border bg-card shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between border-b p-5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      <ClipboardList className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold tracking-tight text-foreground">
                        Count Next
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Priority items for physical verification
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  {countPriority.loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((idx) => (
                        <div key={idx} className="h-12 w-full animate-pulse rounded-md bg-muted" />
                      ))}
                    </div>
                  ) : countItems.length > 0 ? (
                    <ul className="divide-y text-sm">
                      {countItems.map((item, index) => {
                        const displayName = item.product_name ?? item.sku ?? `Item ${index + 1}`;
                        const location = item.location_name ?? 'Stock';
                        const onHand = item.quantity !== undefined ? String(item.quantity) : null;
                        const uom = item.uom ?? '';
                        const level = item.level ?? 'low';
                        const reasonsList = Array.isArray(item.reasons) ? item.reasons : [];

                        return (
                          <li key={item.product_id ?? index} className="py-3.5 first:pt-0 last:pb-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/products/${item.product_id}`}
                                    className="font-medium text-foreground hover:underline truncate"
                                  >
                                    {displayName}
                                  </Link>
                                  {item.level && (
                                    <Badge className={priorityLevelStyles[level]}>
                                      {level}
                                    </Badge>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {item.sku ? `${item.sku} • ` : ''}
                                  <span>{location}</span>
                                </p>
                              </div>
                              {onHand !== null && (
                                <div className="text-right shrink-0">
                                  <span className="font-mono text-xs font-semibold text-foreground">
                                    {onHand} {uom}
                                  </span>
                                  <span className="block text-[10px] text-muted-foreground">on hand</span>
                                </div>
                              )}
                            </div>

                            {reasonsList.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {reasonsList.map((reason, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="inline-flex items-center rounded-md bg-muted/70 px-2 py-0.5 text-[11px] text-muted-foreground"
                                  >
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Physical count up to date</p>
                      <p className="mt-1 text-xs">
                        No critical items pending cycle verification right now.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t bg-muted/30 p-4">
                <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                  <Link href="/operations/adjustments">
                    <span>Manage Stock Counts</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </section>
          </div>

          {/* Recent Operations Section */}
          <section
            aria-label="Recent operations"
            className="overflow-hidden rounded-xl border bg-card shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between border-b p-5">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Recent Operations
                </h2>
                <p className="text-xs text-muted-foreground">
                  Latest stock movements across receipts, deliveries, transfers, and adjustments
                </p>
              </div>
            </div>

            {operations.loading && !summary.data ? (
              <div className="p-8">
                <DataState loading />
              </div>
            ) : (operations.data?.items ?? summary.data.recent_operations).length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                {hasFilters
                  ? 'No recent operations match the selected filters.'
                  : 'No recent operations recorded.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Partner / Route</TableHead>
                      <TableHead className="text-center">Lines</TableHead>
                      <TableHead>Scheduled Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(operations.data?.items ?? summary.data.recent_operations).map((op) => {
                      const typeLabel = typeLabels[op.type] ?? op.type;
                      const statusStyle = statusBadgeStyles[op.status] ?? 'bg-secondary text-secondary-foreground';
                      const statusLabel = statusLabels[op.status] ?? op.status;

                      let routeOrPartner = '—';
                      if (op.partner_name) {
                        routeOrPartner = op.partner_name;
                      } else if (op.source_location && op.destination_location) {
                        routeOrPartner = `${op.source_location.full_name} → ${op.destination_location.full_name}`;
                      } else if (op.destination_location) {
                        routeOrPartner = `To ${op.destination_location.full_name}`;
                      } else if (op.source_location) {
                        routeOrPartner = `From ${op.source_location.full_name}`;
                      }

                      return (
                        <TableRow key={op.id}>
                          <TableCell className="font-mono text-sm font-medium">
                            <span className="text-foreground">{op.reference}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-foreground">{typeLabel}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusStyle}>{statusLabel}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                            {routeOrPartner}
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            {op.line_count}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(op.scheduled_date ?? op.created_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
