// Owner: Member 3. New transfer page.

import { PageHeader } from '@/components/layout/PageHeader';
import { OperationForm } from '@/components/operations/OperationForm';

export default function NewTransferPage() {
  return (
    <>
      <PageHeader
        title="New transfer"
        description="Move stock from one location to another. Source and destination must differ; the transfer stays a draft until you validate it."
      />
      <OperationForm type="transfer" />
    </>
  );
}
