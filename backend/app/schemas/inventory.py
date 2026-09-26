from datetime import datetime
from typing import Literal

from app.schemas.common import ApiModel, Qty, UserRef


class BalanceOut(ApiModel):
    product_id: int
    sku: str
    product_name: str
    uom: str
    location_id: int
    location_name: str
    warehouse_id: int
    quantity: Qty


class AvailableOut(ApiModel):
    product_id: int
    location_id: int
    quantity: Qty


class IntegrityMismatch(ApiModel):
    product_id: int
    location_id: int
    balance: Qty
    ledger_sum: Qty


class IntegrityOut(ApiModel):
    ok: bool
    checked: int
    mismatches: list[IntegrityMismatch]


class LedgerEntryOut(ApiModel):
    id: int
    created_at: datetime
    operation_id: int
    reference: str
    movement_type: str
    product_id: int
    sku: str
    product_name: str
    uom: str
    location_id: int
    location_name: str
    counterpart_location_id: int | None
    counterpart_location_name: str | None
    quantity_delta: Qty
    balance_after: Qty
    created_by: UserRef


class CountPriorityItem(ApiModel):
    product_id: int
    sku: str
    product_name: str
    uom: str
    location_id: int
    location_name: str
    quantity: Qty
    last_counted_at: datetime | None
    days_since_count: int
    movements_since_count: int
    past_discrepancies: int
    score: int  # 0..100
    level: Literal["high", "medium", "low"]
    reasons: list[str]
