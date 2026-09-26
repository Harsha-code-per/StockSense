from datetime import datetime
from decimal import Decimal
from typing import Annotated

from fastapi import Query
from pydantic import BaseModel, ConfigDict, Field, PlainSerializer


class ApiModel(BaseModel):
    """Base for all schemas: reads ORM objects, trims whitespace from strings."""

    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


# Quantities: exact decimals, max 3 places in, always exactly 3 places out ("50.000").
_as_qty_string = PlainSerializer(lambda v: f"{Decimal(v):.3f}", return_type=str, when_used="json")
Qty = Annotated[Decimal, Field(max_digits=18, decimal_places=3), _as_qty_string]
NonNegativeQty = Annotated[Decimal, Field(ge=0, max_digits=18, decimal_places=3), _as_qty_string]
PositiveQty = Annotated[Decimal, Field(gt=0, max_digits=18, decimal_places=3), _as_qty_string]


class Page[T](ApiModel):
    items: list[T]
    total: int
    page: int
    page_size: int


class PageParams:
    def __init__(
        self,
        page: Annotated[int, Query(ge=1)] = 1,
        page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    ):
        self.page = page
        self.page_size = page_size


class UserRef(ApiModel):
    id: int
    name: str


class LocationRef(ApiModel):
    id: int
    full_name: str


class Timestamped(ApiModel):
    created_at: datetime
