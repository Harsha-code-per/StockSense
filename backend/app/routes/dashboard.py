from fastapi import APIRouter, Query

from app.deps import CurrentUser, DbSession
from app.schemas.dashboard import DashboardSummary
from app.services import dashboard_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    db: DbSession,
    _: CurrentUser,
    warehouse_id: int | None = Query(None, description="Filter by warehouse ID"),
    category_id: int | None = Query(None, description="Filter by category ID"),
) -> DashboardSummary:
    """Retrieve dashboard KPIs, low-stock items, recent operations, and ledger health."""
    return dashboard_service.get_dashboard_summary(
        db, warehouse_id=warehouse_id, category_id=category_id
    )
