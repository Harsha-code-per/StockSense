// Owner: Member 3. New delivery page.

import { PageHeader } from '@/components/layout/PageHeader';
import { OperationForm } from '@/components/operations/OperationForm';

export default function NewDeliveryPage() {
  return (
    <>
      <PageHeader
        title="New delivery"
        description="Ship stock out to a customer. The delivery stays a draft until you validate it; confirm checks availability first."
      />
      <OperationForm type="delivery" />
    </>
  );
}
