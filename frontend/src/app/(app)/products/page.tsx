'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { DataState } from '@/components/ui/DataState';
import { StockBadge } from '@/components/ui/StockBadge';
import { selectClass } from '@/components/ui/Field';
import { useApi } from '@/components/ui/useApi';
import type { Category, Page, Product, User } from '@/lib/types';

const filtersSchema = z.object({
  search: z.string().trim(),
  category_id: z.string(),
  stock_status: z.enum(['', 'in_stock', 'low', 'out']),
  is_active: z.enum(['', 'true', 'false']),
});
type Filters = z.infer<typeof filtersSchema>;
export default function ProductsPage() {
  const [filters, setFilters] = useState<Filters>({
    search: '',
    category_id: '',
    stock_status: '',
    is_active: 'true',
  });
  const [page, setPage] = useState(1);
  const form = useForm<Filters>({
    resolver: zodResolver(filtersSchema),
    defaultValues: filters,
  });
  const query = new URLSearchParams({ page: String(page), page_size: '20' });
  for (const [key, value] of Object.entries(filters))
    if (value) query.set(key, value);
  const products = useApi<Page<Product>>(`/api/products?${query}`);
  const categories = useApi<Category[]>('/api/categories');
  const user = useApi<User>('/api/auth/me');
  return (
    <>
      <PageHeader
        title="Products"
        description="Find your inventory, check stock levels, and keep product details up to date."
      >
        {user.data?.role === 'manager' && (
          <Button asChild>
            <Link href="/products/new">
              <Plus aria-hidden="true" />
              New product
            </Link>
          </Button>
        )}
      </PageHeader>
      <section
        aria-label="Product catalog"
        className="min-w-0 overflow-hidden rounded-xl border bg-card"
      >
        <form
          onSubmit={form.handleSubmit((values) => {
            setFilters(values);
            setPage(1);
          })}
          className="grid gap-3 border-b p-4 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_180px_150px_140px_auto]"
        >
          <div>
            <Label htmlFor="search" className="sr-only">
              Search products
            </Label>
            <Input
              id="search"
              placeholder="Search name or SKU"
              {...form.register('search')}
            />
          </div>
          <div>
            <Label htmlFor="category_id" className="sr-only">
              Category
            </Label>
            <select
              id="category_id"
              className={selectClass}
              {...form.register('category_id')}
            >
              <option value="">All categories</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="stock_status" className="sr-only">
              Stock status
            </Label>
            <select
              id="stock_status"
              className={selectClass}
              {...form.register('stock_status')}
            >
              <option value="">All stock levels</option>
              <option value="in_stock">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </div>
          <div>
            <Label htmlFor="is_active" className="sr-only">
              Product status
            </Label>
            <select
              id="is_active"
              className={selectClass}
              {...form.register('is_active')}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
              <option value="">All products</option>
            </select>
          </div>
          <Button variant="outline" type="submit">
            <Search aria-hidden="true" />
            Search
          </Button>
        </form>
        {categories.error && (
          <p role="alert" className="px-4 pt-3 text-sm text-destructive">
            Categories could not be loaded.{' '}
            <button className="underline" onClick={categories.reload}>
              Retry categories
            </button>
          </p>
        )}
        {products.loading || products.error || !products.data?.items.length ? (
          <DataState
            loading={products.loading}
            error={products.error}
            retry={products.reload}
            empty="No products match your filters."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead>Stock level</TableHead>
                <TableHead className="text-right">Suggested order</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.data.items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="py-4 pl-5">
                    <Link
                      href={`/products/${product.id}`}
                      className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      {product.name}
                    </Link>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {product.sku}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.category?.name ?? 'Uncategorized'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {product.on_hand}{' '}
                    <span className="text-muted-foreground">{product.uom}</span>
                  </TableCell>
                  <TableCell>
                    <StockBadge status={product.stock_status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {product.suggested_order}{' '}
                    <span className="text-muted-foreground">{product.uom}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.is_active ? 'Active' : 'Inactive'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
          <span>
            {products.data
              ? `${products.data.total} products · Page ${page}`
              : `Page ${page}`}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page === 1 || products.loading}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={
                !products.data ||
                page * products.data.page_size >= products.data.total ||
                products.loading
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
