// Owner: Member 3. Transfer detail.

'use client';

import { use } from 'react';

import { OperationDetailView } from '@/components/operations/OperationDetailView';

export default function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <OperationDetailView type="transfer" id={id} />;
}
