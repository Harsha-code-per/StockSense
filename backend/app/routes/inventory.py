from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.deps import CurrentUser, DbSession
from app.schemas.common import Page, PageParams
from app.schemas.inventory import AvailableOut, BalanceOut, CountPriorityItem, IntegrityOut
from app.services import count_priority_service, inventory_service

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("", response_model=Page[BalanceOut])
def list_balances(
    db: DbSession,
    _: CurrentUser,
    paging: Annotated[PageParams, Depends()],
    product_id: int | None = None,
    location_id: int | None = None,
    warehouse_id: int | None = None,
    category_id: int | None = None,
    search: str | None = None,
    hide_zero: bool = True,
):
    return inventory_service.list_balances(
        db,
        paging,
        product_id=product_id,
        location_id=location_id,
        warehouse_id=warehouse_id,
        category_id=category_id,
        search=search,
        hide_zero=hide_zero,
    )


@router.get("/available", response_model=AvailableOut)
def available(product_id: int, location_id: int, db: DbSession, _: CurrentUser):
    """Current balance, so forms can show "Available: 60 kg". Validation re-checks anyway."""
    return AvailableOut(
        product_id=product_id,
        location_id=location_id,
        quantity=inventory_service.available(db, product_id, location_id),
    )


@router.get("/integrity", response_model=IntegrityOut)
def integrity(db: DbSession, _: CurrentUser):
    """Proves Σ ledger deltas == balance for every product-location."""
    return inventory_service.integrity(db)


@router.get("/count-priority", response_model=list[CountPriorityItem])
def count_priority(
    db: DbSession,
    _: CurrentUser,
    warehouse_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Which product-locations to physically count next, highest risk first, with reasons."""
    return count_priority_service.count_priority(db, warehouse_id=warehouse_id, limit=limit)
