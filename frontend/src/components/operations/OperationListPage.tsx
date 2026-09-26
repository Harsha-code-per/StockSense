// Owner: Member 3. Shared operations list page — real data from
// GET /api/operations?type=... with search/status filters and pagination.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search } from 'lucide-react';

import type { OperationSummary, OperationType, Page } from '@/lib/types';
import {
  operationsQueryString,
  TYPE_LABELS,
  TYPE_ROUTES,
} from '@/lib/operations';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { selectClass } from '@/components/ui/Field';
import { DataState } from '@/components/ui/DataState';
import { useApi } from '@/components/ui/useApi';
import { OperationTable } from './OperationTable';

const filtersSchema = z.object({
  search: z.string().trim(),
  status: z.enum(['', 'draft', 'waiting', 'ready', 'done', 'canceled']),
});
type Filters = z.infer<typeof filtersSchema>;

export function OperationListPage({
  type,
  description,
}: {
  type: OperationType;
  description: string;
}) {
  const label = TYPE_LABELS[type];
  const listPath = TYPE_ROUTES[type];
  const [filters, setFilters] = useState<Filters>({ search: '', status: '' });
  const [page, setPage] = useState(1);
  const form = useForm<Filters>({
    resolver: zodResolver(filtersSchema),
    defaultValues: filters,
  });

  const query = operationsQueryString({
    type,
    search: filters.search || undefined,
    status: filters.status ? [filters.status] : undefined,
    page,
  });
  const operations = useApi<Page<OperationSummary>>(`/api/operations?${query}`);

  return (
    <>
      <PageHeader title={`${label}s`} description={description}>
        <Button asChild>
          <Link href={`${listPath}/new`}>
            <Plus aria-hidden="true" />
            New {label.toLowerCase()}
          </Link>
        </Button>
      </PageHeader>

      <section
        aria-label={`${label}s`}
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
              Search {label.toLowerCase()}s
            </Label>
            <Input
              id="search"
              placeholder="Search reference or partner"
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

        {operations.loading ||
        operations.error ||
        !operations.data?.items.length ? (
          <DataState
            loading={operations.loading}
            error={operations.error}
            retry={operations.reload}
            empty={`No ${label.toLowerCase()}s match your filters.`}
          />
        ) : (
          <OperationTable items={operations.data.items} type={type} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
          <span>
            {operations.data
              ? `${operations.data.total} ${label.toLowerCase()}s · Page ${page}`
              : `Page ${page}`}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page === 1 || operations.loading}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={
                !operations.data ||
                page * operations.data.page_size >= operations.data.total ||
                operations.loading
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
