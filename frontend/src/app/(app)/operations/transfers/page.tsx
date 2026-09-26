// Owner: Member 3. Transfers list.

import { OperationListPage } from '@/components/operations/OperationListPage';

export default function TransfersPage() {
  return (
    <OperationListPage
      type="transfer"
      description="Move stock between locations. Confirm checks availability at the source; validate applies the move."
    />
  );
}
