from dataclasses import asdict, dataclass
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.deps import CurrentUser, DbSession
from app.enums import OperationType
from app.schemas.common import Page, PageParams
from app.schemas.inventory import LedgerEntryOut
from app.services import inventory_service

router = APIRouter(prefix="/api/ledger", tags=["ledger"])


@dataclass
class LedgerFilters:
    product_id: int | None = None
    location_id: int | None = None
    warehouse_id: int | None = None
    movement_type: OperationType | None = None
    operation_id: int | None = None
    search: str | None = None
    date_from: date | None = None
    date_to: date | None = None


Filters = Annotated[LedgerFilters, Depends()]


@router.get("", response_model=Page[LedgerEntryOut])
def list_ledger(
    db: DbSession, _: CurrentUser, paging: Annotated[PageParams, Depends()], filters: Filters
):
    """Move history (append-only stock ledger), newest first."""
    return inventory_service.list_ledger(db, paging, **asdict(filters))


@router.get(
    "/export.csv",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}}},
)
def export_ledger(db: DbSession, _: CurrentUser, filters: Filters):
    """Download the move history as CSV (same filters as the list)."""
    return Response(
        inventory_service.export_ledger_csv(db, **asdict(filters)),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="stocksense-ledger-{date.today()}.csv"'
        },
    )
