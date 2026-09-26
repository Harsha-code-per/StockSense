from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.deps import CurrentUser, DbSession
from app.enums import OperationType
from app.schemas.common import Page, PageParams
from app.schemas.operation import (
    OperationCreate,
    OperationOut,
    OperationSummary,
    OperationUpdate,
    ValidateResult,
)
from app.services import operation_service

router = APIRouter(prefix="/api/operations", tags=["operations"])


@router.get("", response_model=Page[OperationSummary])
def list_operations(
    db: DbSession,
    _: CurrentUser,
    paging: Annotated[PageParams, Depends()],
    type: OperationType | None = None,
    status: Annotated[str | None, "comma-separated, e.g. draft,waiting,ready"] = None,
    warehouse_id: int | None = None,
    location_id: int | None = None,
    category_id: int | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    return operation_service.list_operations(
        db,
        paging,
        type=type,
        status=status,
        warehouse_id=warehouse_id,
        location_id=location_id,
        category_id=category_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )


@router.post("", response_model=OperationOut, status_code=status.HTTP_201_CREATED)
def create_operation(data: OperationCreate, db: DbSession, user: CurrentUser):
    return operation_service.create_operation(db, data, user)


@router.get("/{operation_id}", response_model=OperationOut)
def get_operation(operation_id: int, db: DbSession, _: CurrentUser):
    return operation_service.get_operation(db, operation_id)


@router.patch("/{operation_id}", response_model=OperationOut)
def update_operation(operation_id: int, data: OperationUpdate, db: DbSession, user: CurrentUser):
    return operation_service.update_operation(db, operation_id, data, user)


@router.post("/{operation_id}/confirm", response_model=OperationOut)
def confirm_operation(operation_id: int, db: DbSession, user: CurrentUser):
    """Availability check: `ready` if every line can be fulfilled now, else `waiting`."""
    return operation_service.confirm(db, operation_id, user)


@router.post("/{operation_id}/validate", response_model=ValidateResult)
def validate_operation(operation_id: int, db: DbSession, user: CurrentUser):
    """Apply the stock change exactly once. Safe to retry (returns `already_done: true`)."""
    return operation_service.validate(db, operation_id, user)


@router.post("/{operation_id}/cancel", response_model=OperationOut)
def cancel_operation(operation_id: int, db: DbSession, user: CurrentUser):
    return operation_service.cancel(db, operation_id, user)
