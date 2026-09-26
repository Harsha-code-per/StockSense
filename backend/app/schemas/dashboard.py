from app.schemas.common import ApiModel, Qty
from app.schemas.operation import OperationSummary


class DashboardKpis(ApiModel):
    products_in_stock: int
    low_stock: int
    out_of_stock: int
    pending_receipts: int
    pending_deliveries: int
    scheduled_transfers: int


class LowStockItem(ApiModel):
    product_id: int
    sku: str
    name: str
    uom: str
    on_hand: Qty
    min_qty: Qty
    suggested_order: Qty
    stock_status: str


class DashboardSummary(ApiModel):
    kpis: DashboardKpis
    low_stock_items: list[LowStockItem]
    recent_operations: list[OperationSummary]
    ledger_ok: bool
