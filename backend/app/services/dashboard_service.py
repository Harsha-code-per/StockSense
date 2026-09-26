from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.enums import OPEN_STATUSES
from app.models import Operation, OperationLine, Product
from app.schemas.common import PageParams
from app.schemas.dashboard import (
    ActivityDay,
    DashboardActivity,
    DashboardKpis,
    DashboardSummary,
    LowStockItem,
    Pipeline,
)
from app.services import inventory_service, operation_service
from app.services.inventory_service import on_hand_subquery, stock_status, suggested_order


def get_dashboard_summary(
    db: Session,
    *,
    warehouse_id: int | None = None,
    category_id: int | None = None,
) -> DashboardSummary:
    """Compute dashboard KPIs, low-stock items, recent operations, and ledger health."""
    # 1. Open operations count (draft, waiting, ready) filtered by warehouse and category
    op_stmt = select(
        func.count(Operation.id).filter(Operation.type == "receipt").label("pending_receipts"),
        func.count(Operation.id).filter(Operation.type == "delivery").label("pending_deliveries"),
        func.count(Operation.id).filter(Operation.type == "transfer").label("scheduled_transfers"),
    ).where(Operation.status.in_(OPEN_STATUSES))

    if warehouse_id is not None:
        op_stmt = op_stmt.where(Operation.warehouse_id == warehouse_id)
    if category_id is not None:
        op_stmt = op_stmt.where(
            select(OperationLine.id)
            .join(OperationLine.product)
            .where(OperationLine.operation_id == Operation.id, Product.category_id == category_id)
            .exists()
        )

    op_counts = db.execute(op_stmt).one()

    # 2. Product stock metrics & low-stock items
    sq = on_hand_subquery(warehouse_id=warehouse_id)
    on_hand = func.coalesce(sq.c.on_hand, Decimal("0"))
    prod_stmt = (
        select(Product, on_hand.label("on_hand"))
        .outerjoin(sq, sq.c.product_id == Product.id)
        .where(Product.is_active)
        .order_by(Product.name)
    )
    if category_id is not None:
        prod_stmt = prod_stmt.where(Product.category_id == category_id)

    products_with_stock = db.execute(prod_stmt).all()

    in_stock_count = 0
    low_stock_count = 0
    out_of_stock_count = 0
    low_stock_items: list[LowStockItem] = []

    for prod, qty in products_with_stock:
        status = stock_status(qty, prod.min_qty)
        if status in ("in_stock", "low"):
            in_stock_count += 1
        if status == "low":
            low_stock_count += 1
        elif status == "out":
            out_of_stock_count += 1
        # Alert on everything below its reorder point, including items that ran out.
        if status in ("low", "out"):
            low_stock_items.append(
                LowStockItem(
                    product_id=prod.id,
                    sku=prod.sku,
                    name=prod.name,
                    uom=prod.uom,
                    on_hand=qty,
                    min_qty=prod.min_qty,
                    suggested_order=suggested_order(qty, prod.min_qty, prod.max_qty),
                    stock_status=status,
                )
            )
    # Most urgent first: out of stock, then low; alphabetical within each group.
    low_stock_items.sort(key=lambda item: (item.stock_status != "out", item.name.lower()))

    # 3. Recent operations (first page of 10 items)
    recent_ops_page = operation_service.list_operations(
        db,
        PageParams(page=1, page_size=10),
        warehouse_id=warehouse_id,
        category_id=category_id,
    )

    # 4. Ledger integrity check
    integrity_result = inventory_service.integrity(db)

    kpis = DashboardKpis(
        products_in_stock=in_stock_count,
        low_stock=low_stock_count,
        out_of_stock=out_of_stock_count,
        pending_receipts=op_counts.pending_receipts,
        pending_deliveries=op_counts.pending_deliveries,
        scheduled_transfers=op_counts.scheduled_transfers,
    )

    return DashboardSummary(
        kpis=kpis,
        low_stock_items=low_stock_items,
        recent_operations=recent_ops_page.items,
        ledger_ok=integrity_result.ok,
    )


def get_activity(
    db: Session, *, days: int = 14, warehouse_id: int | None = None
) -> DashboardActivity:
    """Validated operations per day by type (last `days` days, UTC) and the open pipeline."""
    today = datetime.now(UTC).date()
    first = today - timedelta(days=days - 1)
    day = func.date(func.timezone("UTC", Operation.validated_at))
    done = (
        select(day.label("day"), Operation.type, func.count())
        .where(Operation.status == "done", Operation.validated_at >= first)
        .group_by(day, Operation.type)
    )
    open_ops = (
        select(Operation.status, func.count())
        .where(Operation.status.in_(OPEN_STATUSES))
        .group_by(Operation.status)
    )
    if warehouse_id is not None:
        done = done.where(Operation.warehouse_id == warehouse_id)
        open_ops = open_ops.where(Operation.warehouse_id == warehouse_id)

    by_day = {
        first + timedelta(days=i): ActivityDay(date=first + timedelta(days=i)) for i in range(days)
    }
    for d, op_type, n in db.execute(done):
        if d in by_day:
            setattr(by_day[d], op_type, n)
    return DashboardActivity(
        days=list(by_day.values()),
        pipeline=Pipeline(**{status: n for status, n in db.execute(open_ops)}),
    )
