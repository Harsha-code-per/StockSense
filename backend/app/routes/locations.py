from fastapi import APIRouter, status

from app.deps import CurrentUser, DbSession, ManagerUser
from app.schemas.warehouse import LocationCreate, LocationOut, LocationUpdate
from app.services import warehouse_service

router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.get("", response_model=list[LocationOut])
def list_locations(
    db: DbSession, _: CurrentUser, warehouse_id: int | None = None, is_active: bool | None = None
):
    return warehouse_service.list_locations(db, warehouse_id, is_active)


@router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
def create_location(data: LocationCreate, db: DbSession, _: ManagerUser):
    return warehouse_service.create_location(db, data)


@router.patch("/{location_id}", response_model=LocationOut)
def update_location(location_id: int, data: LocationUpdate, db: DbSession, _: ManagerUser):
    return warehouse_service.update_location(db, location_id, data)
