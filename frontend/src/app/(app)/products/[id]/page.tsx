'use client';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/DataState';
import { StockBadge } from '@/components/ui/StockBadge';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { useApi } from '@/components/ui/useApi';
import type { ProductDetail, User } from '@/lib/types';
export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const result = useApi<ProductDetail>(
    `/api/products/${encodeURIComponent(id)}`,
  );
  const user = useApi<User>('/api/auth/me');
  const product = result.data;
  if (!product)
    return (
      <DataState
        loading={result.loading}
        error={result.error}
        retry={result.reload}
      />
    );
  return (
    <>
      <Link
        href="/products"
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Products
      </Link>
      <PageHeader
        title={product.name}
        description={`${product.sku} · ${product.category?.name ?? 'Uncategorized'} · ${product.is_active ? 'Active' : 'Inactive'}`}
      >
        {user.data?.role === 'manager' && (
          <Button asChild variant="outline">
            <Link href={`/products/${product.id}/edit`}>
              <Pencil aria-hidden="true" />
              Edit product
            </Link>
          </Button>
        )}
      </PageHeader>
      <section
        aria-label="Stock overview"
        className="mb-7 rounded-xl border bg-card p-6"
      >
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <h2 className="text-lg font-semibold">Stock overview</h2>
          <StockBadge status={product.stock_status} />
        </div>
        <dl className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {[
            ['On hand', product.on_hand],
            ['Minimum', product.min_qty],
            ['Maximum', product.max_qty],
            ['Suggested order', product.suggested_order],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-2 text-xl font-semibold tabular-nums">
                {value}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  {product.uom}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        {product.description && (
          <p className="mt-6 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {product.description}
          </p>
        )}
      </section>
      <section className="mb-7 min-w-0 overflow-hidden rounded-xl border bg-card">
        <h2 className="border-b px-5 py-5 text-lg font-semibold">
          Stock by location
        </h2>
        {product.stock_by_location.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Location</TableHead>
                <TableHead className="pr-5 text-right">On hand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.stock_by_location.map((stock) => (
                <TableRow key={stock.location_id}>
                  <TableCell className="py-4 pl-5">
                    {stock.location_name}
                  </TableCell>
                  <TableCell className="pr-5 text-right tabular-nums">
                    {stock.quantity} {product.uom}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <DataState empty="No stock has been recorded for this product." />
        )}
      </section>
      <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-5">
          <h2 className="text-lg font-semibold">Recent movements</h2>
          <Link
            href={`/history?product_id=${product.id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            View history
          </Link>
        </div>
        {product.recent_moves.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Reference</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="pr-5 text-right">Balance after</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.recent_moves.map((move) => (
                <TableRow key={move.id}>
                  <TableCell className="py-4 pl-5 font-medium">
                    {move.reference}
                  </TableCell>
                  <TableCell>
                    {new Date(move.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{move.location_name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {move.quantity_delta} {move.uom}
                  </TableCell>
                  <TableCell className="pr-5 text-right tabular-nums">
                    {move.balance_after} {move.uom}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <DataState empty="No movements yet. Stock movements will appear here after validation." />
        )}
      </section>
    </>
  );
}
