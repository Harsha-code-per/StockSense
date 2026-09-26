// Owner: Member 3. Adjustments list.

import { OperationListPage } from '@/components/operations/OperationListPage';
import { SmartCountRiskPanel } from '@/components/motion/SmartCountRiskPanel';

export default function AdjustmentsPage() {
  return (
    <div className="space-y-6">
      <SmartCountRiskPanel />
      <OperationListPage
        type="adjustment"
        description="Reconcile recorded stock with a physical count. Enter what you counted; the backend applies the difference. Validation requires a manager."
      />
    </div>
  );
}
