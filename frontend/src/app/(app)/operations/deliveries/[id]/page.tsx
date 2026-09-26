// Owner: Member 3. Delivery detail.

'use client';

import { use } from 'react';

import { OperationDetailView } from '@/components/operations/OperationDetailView';

export default function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <OperationDetailView type="delivery" id={id} />;
}
