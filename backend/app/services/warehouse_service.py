from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.errors import InvalidState
from app.models import Location, StockBalance, Warehouse
from app.schemas.warehouse import LocationCreate, LocationUpdate, WarehouseCreate, WarehouseUpdate
from app.services.common import get_or_404, require_ref

DEFAULT_LOCATION = "Stock"


def _has_stock(db: Session, *conditions) -> bool:
    stmt = select(StockBalance.product_id).join(StockBalance.location)
    return db.scalar(stmt.where(StockBalance.quantity != 0, *conditions).limit(1)) is not None


# ---------- warehouses ----------


def list_warehouses(db: Session, is_active: bool | None = None) -> list[Warehouse]:
    stmt = select(Warehouse).options(selectinload(Warehouse.locations)).order_by(Warehouse.code)
    if is_active is not None:
        stmt = stmt.where(Warehouse.is_active == is_active)
    return list(db.scalars(stmt))


def create_warehouse(db: Session, data: WarehouseCreate) -> Warehouse:
    warehouse = Warehouse(**data.model_dump())
    warehouse.locations.append(Location(name=DEFAULT_LOCATION))
    db.add(warehouse)
    db.commit()  # duplicate code -> 409 DUPLICATE (field "code")
    return warehouse


def update_warehouse(db: Session, warehouse_id: int, data: WarehouseUpdate) -> Warehouse:
    warehouse = get_or_404(db, Warehouse, warehouse_id, "Warehouse")
    changes = data.model_dump(exclude_unset=True)
    if changes.get("is_active") is False and _has_stock(db, Location.warehouse_id == warehouse_id):
        raise InvalidState("Move or adjust all stock out of this warehouse before deactivating it.")
    for field, value in changes.items():
        if value is not None or field == "address":
            setattr(warehouse, field, value)
    db.commit()
    return warehouse


# ---------- locations ----------


def list_locations(
    db: Session, warehouse_id: int | None = None, is_active: bool | None = None
) -> list[Location]:
    stmt = select(Location).join(Location.warehouse).order_by(Warehouse.code, Location.name)
    if warehouse_id is not None:
        stmt = stmt.where(Location.warehouse_id == warehouse_id)
    if is_active is not None:
        stmt = stmt.where(Location.is_active == is_active)
    return list(db.scalars(stmt))


def create_location(db: Session, data: LocationCreate) -> Location:
    require_ref(db, Warehouse, data.warehouse_id, "warehouse_id", "Warehouse")
    location = Location(**data.model_dump())
    db.add(location)
    db.commit()  # duplicate name in warehouse -> 409 DUPLICATE (field "name")
    return location


def update_location(db: Session, location_id: int, data: LocationUpdate) -> Location:
    location = get_or_404(db, Location, location_id, "Location")
    changes = data.model_dump(exclude_unset=True)
    if changes.get("is_active") is False and _has_stock(db, Location.id == location_id):
        raise InvalidState("This location still holds stock. Move or adjust it first.")
    for field, value in changes.items():
        if value is not None:
            setattr(location, field, value)
    db.commit()
    return location
