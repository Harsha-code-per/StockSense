from datetime import date

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


class ActivityDay(ApiModel):
    date: date
    receipt: int = 0
    delivery: int = 0
    transfer: int = 0
    adjustment: int = 0


class Pipeline(ApiModel):
    draft: int = 0
    waiting: int = 0
    ready: int = 0


class DashboardActivity(ApiModel):
    days: list[ActivityDay]
    pipeline: Pipeline
