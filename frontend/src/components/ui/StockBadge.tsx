import { Badge } from '@/components/ui/badge';
import type { StockStatus } from '@/lib/types';
const styles = {
  in_stock: 'bg-success-soft text-success',
  low: 'bg-warning-soft text-warning',
  out: 'bg-danger-soft text-danger',
};
const labels = { in_stock: 'In stock', low: 'Low stock', out: 'Out of stock' };
export function StockBadge({ status }: { status: StockStatus }) {
  return <Badge className={styles[status]}>{labels[status]}</Badge>;
}
