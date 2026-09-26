'use client';
import { use } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataState } from '@/components/ui/DataState';
import { useApi } from '@/components/ui/useApi';
import type { ProductDetail } from '@/lib/types';
import { ProductForm } from '../../ProductForm';
export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const product = useApi<ProductDetail>(
    `/api/products/${encodeURIComponent(id)}`,
  );
  return (
    <>
      <PageHeader
        title="Edit product"
        description="Update catalog details and replenishment thresholds."
      />
      {product.data ? (
        <ProductForm key={product.data.id} product={product.data} />
      ) : (
        <DataState
          loading={product.loading}
          error={product.error}
          retry={product.reload}
        />
      )}
    </>
  );
}
