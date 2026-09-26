// Owner: Member 3. New receipt page.

import { PageHeader } from '@/components/layout/PageHeader';
import { OperationForm } from '@/components/operations/OperationForm';

export default function NewReceiptPage() {
  return (
    <>
      <PageHeader
        title="New receipt"
        description="Record incoming stock from a vendor. The receipt stays a draft until you validate it."
      />
      <OperationForm type="receipt" />
    </>
  );
}
