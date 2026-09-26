// Owner: Member 3. Adjustments list.

import { OperationListPage } from '@/components/operations/OperationListPage';

export default function AdjustmentsPage() {
  return (
    <OperationListPage
      type="adjustment"
      description="Reconcile recorded stock with a physical count. Enter what you counted; the backend applies the difference. Validation requires a manager."
    />
  );
}
