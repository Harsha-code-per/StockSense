'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Download,
  Filter,
  RotateCcw,
  Search,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataState } from '@/components/ui/DataState';
import { selectClass } from '@/components/ui/Field';
import { useApi } from '@/components/ui/useApi';
import type {
  LedgerEntry,
  Location,
  OperationType,
  Page,
  Warehouse,
} from '@/lib/types';

const movementTypeStyles: Record<OperationType, string> = {
  receipt: 'bg-success-soft text-success',
  delivery: 'bg-info-soft text-info',
  transfer: 'bg-accent text-accent-foreground',
  adjustment: 'bg-warning-soft text-warning',
};

const movementTypeLabels: Record<OperationType, string> = {
  receipt: 'Receipt',
  delivery: 'Delivery',
  transfer: 'Transfer',
  adjustment: 'Adjustment',
};

function formatTimestamp(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

export default function MoveHistoryPage() {
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [movementType, setMovementType] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Active query filters
  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    movement_type: '',
    warehouse_id: '',
    location_id: '',
    date_from: '',
    date_to: '',
  });

  const queryParams = new URLSearchParams({
    page: String(page),
    page_size: '20',
  });
  if (appliedFilters.search) queryParams.set('search', appliedFilters.search);
  if (appliedFilters.movement_type) queryParams.set('movement_type', appliedFilters.movement_type);
  if (appliedFilters.warehouse_id) queryParams.set('warehouse_id', appliedFilters.warehouse_id);
  if (appliedFilters.location_id) queryParams.set('location_id', appliedFilters.location_id);
  if (appliedFilters.date_from) queryParams.set('date_from', appliedFilters.date_from);
  if (appliedFilters.date_to) queryParams.set('date_to', appliedFilters.date_to);

  const ledger = useApi<Page<LedgerEntry>>(`/api/ledger?${queryParams.toString()}`);
  const warehouses = useApi<Warehouse[]>('/api/warehouses?is_active=true');
  const locationsQuery = appliedFilters.warehouse_id
    ? `/api/locations?is_active=true&warehouse_id=${appliedFilters.warehouse_id}`
    : '/api/locations?is_active=true';
  const locations = useApi<Location[]>(locationsQuery);

  // Export CSV URL using the exact active filters (without page/page_size)
  const exportParams = new URLSearchParams();
  if (appliedFilters.search) exportParams.set('search', appliedFilters.search);
  if (appliedFilters.movement_type) exportParams.set('movement_type', appliedFilters.movement_type);
  if (appliedFilters.warehouse_id) exportParams.set('warehouse_id', appliedFilters.warehouse_id);
  if (appliedFilters.location_id) exportParams.set('location_id', appliedFilters.location_id);
  if (appliedFilters.date_from) exportParams.set('date_from', appliedFilters.date_from);
  if (appliedFilters.date_to) exportParams.set('date_to', appliedFilters.date_to);
  const exportCsvUrl = `/api/ledger/export.csv${exportParams.toString() ? `?${exportParams.toString()}` : ''}`;

  const hasActiveFilters = Boolean(
    appliedFilters.search ||
      appliedFilters.movement_type ||
      appliedFilters.warehouse_id ||
      appliedFilters.location_id ||
      appliedFilters.date_from ||
      appliedFilters.date_to,
  );

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAppliedFilters({
      search: search.trim(),
      movement_type: movementType,
      warehouse_id: warehouseId,
      location_id: locationId,
      date_from: dateFrom,
      date_to: dateTo,
    });
    setPage(1);
  }

  function handleReset() {
    setSearch('');
    setMovementType('');
    setWarehouseId('');
    setLocationId('');
    setDateFrom('');
    setDateTo('');
    setAppliedFilters({
      search: '',
      movement_type: '',
      warehouse_id: '',
      location_id: '',
      date_from: '',
      date_to: '',
    });
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Move History"
        description="Immutable audit trail of all historical stock movements, ledger adjustments, and inventory transfers."
      >
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" className="gap-2">
            <a href={exportCsvUrl} download aria-label="Export move history to CSV">
              <Download className="size-4" aria-hidden="true" />
              <span>Export CSV</span>
            </a>
          </Button>
        </div>
      </PageHeader>

      {/* Filters Form */}
      <section
        aria-label="Filter move history"
        className="rounded-xl border bg-card p-4 shadow-xs"
      >
        <form onSubmit={handleFilterSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {/* Search */}
            <div>
              <Label htmlFor="history-search" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="history-search"
                  placeholder="SKU, product, or ref"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Movement Type */}
            <div>
              <Label htmlFor="history-type" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Movement Type
              </Label>
              <select
                id="history-type"
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
                className={selectClass}
              >
                <option value="">All movement types</option>
                <option value="receipt">Receipt (Incoming)</option>
                <option value="delivery">Delivery (Outgoing)</option>
                <option value="transfer">Transfer (Internal)</option>
                <option value="adjustment">Adjustment (Count)</option>
              </select>
            </div>

            {/* Warehouse */}
            <div>
              <Label htmlFor="history-warehouse" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Warehouse
              </Label>
              <select
                id="history-warehouse"
                value={warehouseId}
                onChange={(e) => {
                  setWarehouseId(e.target.value);
                  setLocationId('');
                }}
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

            {/* Location */}
            <div>
              <Label htmlFor="history-location" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Location
              </Label>
              <select
                id="history-location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className={selectClass}
                disabled={locations.loading}
              >
                <option value="">All locations</option>
                {locations.data?.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <Label htmlFor="history-date-from" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Date From
              </Label>
              <Input
                id="history-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            {/* Date To */}
            <div>
              <Label htmlFor="history-date-to" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Date To
              </Label>
              <Input
                id="history-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" className="gap-1.5">
                <Filter className="size-3.5" aria-hidden="true" />
                <span>Apply Filters</span>
              </Button>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  <span>Reset</span>
                </Button>
              )}
            </div>

            {ledger.data && (
              <span className="text-xs text-muted-foreground">
                Total entries: {ledger.data.total}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* Ledger Table Section */}
      <section
        aria-label="Ledger entries table"
        className="overflow-hidden rounded-xl border bg-card shadow-xs"
      >
        {ledger.loading ? (
          <DataState loading />
        ) : ledger.error ? (
          <DataState error={ledger.error} retry={ledger.reload} />
        ) : !ledger.data || ledger.data.items.length === 0 ? (
          <DataState empty="No move history entries match the selected filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Counterpart</TableHead>
                    <TableHead className="text-right">Quantity Delta</TableHead>
                    <TableHead className="text-right">Balance After</TableHead>
                    <TableHead>Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.data.items.map((entry) => {
                    const typeStyle = movementTypeStyles[entry.movement_type] ?? 'bg-secondary text-secondary-foreground';
                    const typeLabel = movementTypeLabels[entry.movement_type] ?? entry.movement_type;
                    const isNegative = String(entry.quantity_delta).startsWith('-');

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatTimestamp(entry.created_at)}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium">
                          <span className="text-foreground">{entry.reference}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={typeStyle}>{typeLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/products/${entry.product_id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {entry.product_name}
                          </Link>
                          <span className="block text-xs font-mono text-muted-foreground">
                            {entry.sku}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.location_name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.counterpart_location_name ?? '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          <span className={isNegative ? 'text-destructive' : 'text-success'}>
                            {isNegative ? entry.quantity_delta : `+${entry.quantity_delta}`}{' '}
                            <span className="text-xs font-normal text-muted-foreground">{entry.uom}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {entry.balance_after}{' '}
                          <span className="text-xs text-muted-foreground">{entry.uom}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.created_by.name}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
              <span>
                {ledger.data.total > 0
                  ? `${ledger.data.total} records · Page ${ledger.data.page} of ${Math.ceil(ledger.data.total / ledger.data.page_size)}`
                  : `Page ${page}`}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1 || ledger.loading}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    page * ledger.data.page_size >= ledger.data.total ||
                    ledger.loading
                  }
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
