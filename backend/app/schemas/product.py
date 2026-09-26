from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field, ValidationInfo, field_validator

from app.enums import Uom
from app.schemas.common import ApiModel, NonNegativeQty, Qty
from app.schemas.inventory import LedgerEntryOut

StockStatus = Literal["in_stock", "low", "out"]
Sku = Annotated[str, Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$")]


class CategoryCreate(ApiModel):
    name: Annotated[str, Field(min_length=1, max_length=80)]


class CategoryOut(ApiModel):
    id: int
    name: str


class ProductCreate(ApiModel):
    sku: Sku
    name: Annotated[str, Field(min_length=1, max_length=160)]
    category_id: int | None = None
    uom: Uom
    min_qty: NonNegativeQty = Decimal("0")
    max_qty: NonNegativeQty = Decimal("0")
    description: Annotated[str | None, Field(max_length=2000)] = None

    @field_validator("sku")
    @classmethod
    def _upper_sku(cls, v: str) -> str:
        return v.upper()

    @field_validator("max_qty")
    @classmethod
    def _max_gte_min(cls, v, info: ValidationInfo):
        min_qty = info.data.get("min_qty")
        if min_qty is not None and v < min_qty:
            raise ValueError("Max quantity must be greater than or equal to min quantity.")
        return v


class ProductUpdate(ApiModel):
    sku: Sku | None = None
    name: Annotated[str | None, Field(min_length=1, max_length=160)] = None
    category_id: int | None = None
    uom: Uom | None = None
    min_qty: NonNegativeQty | None = None
    max_qty: NonNegativeQty | None = None
    description: Annotated[str | None, Field(max_length=2000)] = None
    is_active: bool | None = None

    @field_validator("sku")
    @classmethod
    def _upper_sku(cls, v: str | None) -> str | None:
        return v.upper() if v else v


class ProductOut(ApiModel):
    id: int
    sku: str
    name: str
    category: CategoryOut | None
    uom: str
    min_qty: Qty
    max_qty: Qty
    description: str | None
    on_hand: Qty
    stock_status: StockStatus
    suggested_order: Qty
    is_active: bool
    created_at: datetime


class StockByLocation(ApiModel):
    location_id: int
    location_name: str
    warehouse_id: int
    quantity: Qty


class ProductDetail(ProductOut):
    stock_by_location: list[StockByLocation]
    recent_moves: list[LedgerEntryOut]
