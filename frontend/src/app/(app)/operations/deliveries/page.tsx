// Owner: Member 3. Deliveries list.

import { OperationListPage } from '@/components/operations/OperationListPage';

export default function DeliveriesPage() {
  return (
    <OperationListPage
      type="delivery"
      description="Outgoing stock to customers. Create a delivery, confirm it to check stock, then validate it to deduct stock."
    />
  );
}
