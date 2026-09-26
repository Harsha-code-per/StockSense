from typing import Annotated

from pydantic import Field, field_validator

from app.schemas.common import ApiModel

WarehouseCode = Annotated[str, Field(min_length=2, max_length=5, pattern=r"^[A-Za-z0-9]+$")]


class WarehouseCreate(ApiModel):
    code: WarehouseCode
    name: Annotated[str, Field(min_length=1, max_length=120)]
    address: Annotated[str | None, Field(max_length=500)] = None

    @field_validator("code")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()


class WarehouseUpdate(ApiModel):
    name: Annotated[str | None, Field(min_length=1, max_length=120)] = None
    address: Annotated[str | None, Field(max_length=500)] = None
    is_active: bool | None = None


class WarehouseOut(ApiModel):
    id: int
    code: str
    name: str
    address: str | None
    is_active: bool
    location_count: int


class LocationCreate(ApiModel):
    warehouse_id: int
    name: Annotated[str, Field(min_length=1, max_length=80)]


class LocationUpdate(ApiModel):
    name: Annotated[str | None, Field(min_length=1, max_length=80)] = None
    is_active: bool | None = None


class LocationOut(ApiModel):
    id: int
    warehouse_id: int
    warehouse_code: str
    name: str
    full_name: str
    is_active: bool
