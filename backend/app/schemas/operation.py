from datetime import date, datetime
from typing import Annotated

from pydantic import Field

from app.enums import OperationStatus, OperationType
from app.schemas.common import ApiModel, LocationRef, NonNegativeQty, PositiveQty, Qty, UserRef

PartnerName = Annotated[str | None, Field(max_length=160)]
Notes = Annotated[str | None, Field(max_length=2000)]


class LineIn(ApiModel):
    product_id: int
    quantity: PositiveQty | None = None  # receipt / delivery / transfer
    counted_quantity: NonNegativeQty | None = None  # adjustment


class OperationCreate(ApiModel):
    type: OperationType
    source_location_id: int | None = None
    destination_location_id: int | None = None
    partner_name: PartnerName = None
    scheduled_date: date | None = None
    notes: Notes = None
    lines: Annotated[list[LineIn], Field(min_length=1, max_length=200)]


class OperationUpdate(ApiModel):
    """PATCH a draft. Omitted fields stay as they are; `lines`, if sent, replaces all lines."""

    source_location_id: int | None = None
    destination_location_id: int | None = None
    partner_name: PartnerName = None
    scheduled_date: date | None = None
    notes: Notes = None
    lines: Annotated[list[LineIn] | None, Field(min_length=1, max_length=200)] = None


class LineOut(ApiModel):
    id: int
    product_id: int
    sku: str
    product_name: str
    uom: str
    quantity: Qty | None
    counted_quantity: Qty | None
    system_quantity: Qty | None
    available: Qty  # balance at the source (destination for receipts) right now


class OperationSummary(ApiModel):
    id: int
    reference: str
    type: OperationType
    status: OperationStatus
    partner_name: str | None
    source_location: LocationRef | None
    destination_location: LocationRef | None
    scheduled_date: date | None
    line_count: int
    created_at: datetime
    validated_at: datetime | None


class OperationOut(ApiModel):
    id: int
    reference: str
    type: OperationType
    status: OperationStatus
    warehouse_id: int
    source_location: LocationRef | None
    destination_location: LocationRef | None
    partner_name: str | None
    scheduled_date: date | None
    notes: str | None
    lines: list[LineOut]
    created_by: UserRef
    validated_by: UserRef | None
    created_at: datetime
    validated_at: datetime | None
    canceled_at: datetime | None


class StockEffect(ApiModel):
    product_id: int
    sku: str
    location_id: int
    location_name: str
    quantity_delta: Qty
    balance_after: Qty


class ValidateResult(OperationOut):
    already_done: bool
    stock_effects: list[StockEffect]
