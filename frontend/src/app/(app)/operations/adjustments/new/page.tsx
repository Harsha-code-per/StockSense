// Owner: Member 3. New adjustment page.

import { PageHeader } from '@/components/layout/PageHeader';
import { OperationForm } from '@/components/operations/OperationForm';

export default function NewAdjustmentPage() {
  return (
    <>
      <PageHeader
        title="New adjustment"
        description="Enter the physical count for each product at a location. The backend compares it to the recorded stock and a manager validates the result."
      />
      <OperationForm type="adjustment" />
    </>
  );
}
