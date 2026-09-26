from fastapi import APIRouter, status

from app.deps import CurrentUser, DbSession, ManagerUser
from app.schemas.warehouse import WarehouseCreate, WarehouseOut, WarehouseUpdate
from app.services import warehouse_service

router = APIRouter(prefix="/api/warehouses", tags=["warehouses"])


@router.get("", response_model=list[WarehouseOut])
def list_warehouses(db: DbSession, _: CurrentUser, is_active: bool | None = None):
    return warehouse_service.list_warehouses(db, is_active)


@router.post("", response_model=WarehouseOut, status_code=status.HTTP_201_CREATED)
def create_warehouse(data: WarehouseCreate, db: DbSession, _: ManagerUser):
    return warehouse_service.create_warehouse(db, data)


@router.patch("/{warehouse_id}", response_model=WarehouseOut)
def update_warehouse(warehouse_id: int, data: WarehouseUpdate, db: DbSession, _: ManagerUser):
    return warehouse_service.update_warehouse(db, warehouse_id, data)
