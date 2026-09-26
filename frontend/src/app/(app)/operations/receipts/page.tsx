// Owner: Member 3. Receipts list — real data from GET /api/operations?type=receipt.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search } from 'lucide-react';

import type { OperationSummary, Page } from '@/lib/types';
import { operationsQueryString, TYPE_ROUTES } from '@/lib/operations';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { selectClass } from '@/components/ui/Field';
import { DataState } from '@/components/ui/DataState';
import { useApi } from '@/components/ui/useApi';
import { OperationTable } from '@/components/operations/OperationTable';

const filtersSchema = z.object({
  search: z.string().trim(),
  status: z.enum(['', 'draft', 'waiting', 'ready', 'done', 'canceled']),
});
type Filters = z.infer<typeof filtersSchema>;

export default function ReceiptsPage() {
  const [filters, setFilters] = useState<Filters>({ search: '', status: '' });
  const [page, setPage] = useState(1);
  const form = useForm<Filters>({
    resolver: zodResolver(filtersSchema),
    defaultValues: filters,
  });

  const query = operationsQueryString({
    type: 'receipt',
    search: filters.search || undefined,
    status: filters.status ? [filters.status] : undefined,
    page,
  });
  const receipts = useApi<Page<OperationSummary>>(`/api/operations?${query}`);

  return (
    <>
      <PageHeader
        title="Receipts"
        description="Incoming stock from vendors. Create a receipt, confirm it, then validate it to add stock."
      >
        <Button asChild>
          <Link href={`${TYPE_ROUTES.receipt}/new`}>
            <Plus aria-hidden="true" />
            New receipt
          </Link>
        </Button>
      </PageHeader>

      <section
        aria-label="Receipts"
        className="min-w-0 overflow-hidden rounded-xl border bg-card"
      >
        <form
          onSubmit={form.handleSubmit((values) => {
            setFilters(values);
            setPage(1);
          })}
          className="grid gap-3 border-b p-4 sm:grid-cols-[minmax(200px,1fr)_180px_auto]"
        >
          <div>
            <Label htmlFor="search" className="sr-only">
              Search receipts
            </Label>
            <Input
              id="search"
              placeholder="Search reference or vendor"
              {...form.register('search')}
            />
          </div>
          <div>
            <Label htmlFor="status" className="sr-only">
              Status
            </Label>
            <select
              id="status"
              className={selectClass}
              {...form.register('status')}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="waiting">Waiting</option>
              <option value="ready">Ready</option>
              <option value="done">Done</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
          <Button variant="outline" type="submit">
            <Search aria-hidden="true" />
            Search
          </Button>
        </form>

        {receipts.loading || receipts.error || !receipts.data?.items.length ? (
          <DataState
            loading={receipts.loading}
            error={receipts.error}
            retry={receipts.reload}
            empty="No receipts match your filters."
          />
        ) : (
          <OperationTable items={receipts.data.items} type="receipt" />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
          <span>
            {receipts.data
              ? `${receipts.data.total} receipts · Page ${page}`
              : `Page ${page}`}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page === 1 || receipts.loading}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={
                !receipts.data ||
                page * receipts.data.page_size >= receipts.data.total ||
                receipts.loading
              }
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
