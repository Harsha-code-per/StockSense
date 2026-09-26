// Owner: Member 3. Adjustment detail.

'use client';

import { use } from 'react';

import { OperationDetailView } from '@/components/operations/OperationDetailView';

export default function AdjustmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <OperationDetailView type="adjustment" id={id} />;
}
