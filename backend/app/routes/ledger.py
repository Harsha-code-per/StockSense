from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends

from app.deps import CurrentUser, DbSession
from app.enums import OperationType
from app.schemas.common import Page, PageParams
from app.schemas.inventory import LedgerEntryOut
from app.services import inventory_service

router = APIRouter(prefix="/api/ledger", tags=["ledger"])


@router.get("", response_model=Page[LedgerEntryOut])
def list_ledger(
    db: DbSession,
    _: CurrentUser,
    paging: Annotated[PageParams, Depends()],
    product_id: int | None = None,
    location_id: int | None = None,
    warehouse_id: int | None = None,
    movement_type: OperationType | None = None,
    operation_id: int | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """Move history (append-only stock ledger), newest first."""
    return inventory_service.list_ledger(
        db,
        paging,
        product_id=product_id,
        location_id=location_id,
        warehouse_id=warehouse_id,
        movement_type=movement_type,
        operation_id=operation_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )
