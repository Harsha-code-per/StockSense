// Owner: Member 3. Receipts list.

import { OperationListPage } from '@/components/operations/OperationListPage';

export default function ReceiptsPage() {
  return (
    <OperationListPage
      type="receipt"
      description="Incoming stock from vendors. Create a receipt, confirm it, then validate it to add stock."
    />
  );
}
