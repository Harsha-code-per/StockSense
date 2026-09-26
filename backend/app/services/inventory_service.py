"""Read side of inventory: balances, availability, low-stock math, ledger views, integrity.

Stock is WRITTEN only by operation_service. Nothing here mutates balances.
"""

import csv
import io
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import Select, Subquery, func, select, text
from sqlalchemy.orm import Session, contains_eager

from app.models import Location, Operation, Product, StockBalance, StockLedger, Warehouse
from app.schemas.common import Page, PageParams, UserRef
from app.schemas.inventory import BalanceOut, IntegrityMismatch, IntegrityOut, LedgerEntryOut
from app.services.common import paginate

ZERO = Decimal("0")


def stock_status(on_hand: Decimal, min_qty: Decimal) -> str:
    if on_hand <= 0:
        return "out"
    return "low" if on_hand < min_qty else "in_stock"


def suggested_order(on_hand: Decimal, min_qty: Decimal, max_qty: Decimal) -> Decimal:
    """Reorder up to max_qty once stock falls below min_qty (or runs out)."""
    if stock_status(on_hand, min_qty) == "in_stock":
        return ZERO
    return max(max_qty - on_hand, ZERO)


def on_hand_subquery(warehouse_id: int | None = None) -> Subquery:
    """(product_id, on_hand) summed over active locations, optionally one warehouse."""
    stmt = (
        select(StockBalance.product_id, func.sum(StockBalance.quantity).label("on_hand"))
        .join(Location, Location.id == StockBalance.location_id)
        .where(Location.is_active)
        .group_by(StockBalance.product_id)
    )
    if warehouse_id is not None:
        stmt = stmt.where(Location.warehouse_id == warehouse_id)
    return stmt.subquery()


def available(db: Session, product_id: int, location_id: int) -> Decimal:
    qty = db.scalar(
        select(StockBalance.quantity).where(
            StockBalance.product_id == product_id, StockBalance.location_id == location_id
        )
    )
    return qty if qty is not None else ZERO


def balance_out(b: StockBalance) -> BalanceOut:
    return BalanceOut(
        product_id=b.product_id,
        sku=b.product.sku,
        product_name=b.product.name,
        uom=b.product.uom,
        location_id=b.location_id,
        location_name=b.location.full_name,
        warehouse_id=b.location.warehouse_id,
        quantity=b.quantity,
    )


def list_balances(
    db: Session,
    paging: PageParams,
    *,
    product_id: int | None = None,
    location_id: int | None = None,
    warehouse_id: int | None = None,
    category_id: int | None = None,
    search: str | None = None,
    hide_zero: bool = True,
) -> Page[BalanceOut]:
    stmt = (
        select(StockBalance)
        .join(StockBalance.product)
        .join(StockBalance.location)
        .join(Location.warehouse)
        .options(
            contains_eager(StockBalance.product),
            contains_eager(StockBalance.location).contains_eager(Location.warehouse),
        )
        .order_by(Product.name, Warehouse.code, Location.name)
    )
    if product_id is not None:
        stmt = stmt.where(StockBalance.product_id == product_id)
    if location_id is not None:
        stmt = stmt.where(StockBalance.location_id == location_id)
    if warehouse_id is not None:
        stmt = stmt.where(Location.warehouse_id == warehouse_id)
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if search:
        stmt = stmt.where(
            Product.sku.icontains(search, autoescape=True)
            | Product.name.icontains(search, autoescape=True)
        )
    if hide_zero:
        stmt = stmt.where(StockBalance.quantity != 0)
    rows, total = paginate(db, stmt, paging)
    return Page(
        items=[balance_out(r[0]) for r in rows],
        total=total,
        page=paging.page,
        page_size=paging.page_size,
    )


def ledger_entry_out(e: StockLedger) -> LedgerEntryOut:
    return LedgerEntryOut(
        id=e.id,
        created_at=e.created_at,
        operation_id=e.operation_id,
        reference=e.operation.reference,
        movement_type=e.movement_type,
        product_id=e.product_id,
        sku=e.product.sku,
        product_name=e.product.name,
        uom=e.product.uom,
        location_id=e.location_id,
        location_name=e.location.full_name,
        counterpart_location_id=e.counterpart_location_id,
        counterpart_location_name=(
            e.counterpart_location.full_name if e.counterpart_location else None
        ),
        quantity_delta=e.quantity_delta,
        balance_after=e.balance_after,
        created_by=UserRef(id=e.creator.id, name=e.creator.name),
    )


def recent_moves(db: Session, product_id: int, limit: int = 10) -> list[LedgerEntryOut]:
    rows = db.scalars(
        select(StockLedger)
        .where(StockLedger.product_id == product_id)
        .order_by(StockLedger.id.desc())
        .limit(limit)
    )
    return [ledger_entry_out(e) for e in rows]


def ledger_query(
    *,
    product_id: int | None = None,
    location_id: int | None = None,
    warehouse_id: int | None = None,
    movement_type: str | None = None,
    operation_id: int | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> Select:
    """Filtered move history, newest first. Shared by the list and the CSV export."""
    stmt = select(StockLedger).order_by(StockLedger.id.desc())
    if product_id is not None:
        stmt = stmt.where(StockLedger.product_id == product_id)
    if location_id is not None:
        stmt = stmt.where(StockLedger.location_id == location_id)
    if warehouse_id is not None:
        stmt = stmt.where(
            StockLedger.location_id.in_(
                select(Location.id).where(Location.warehouse_id == warehouse_id)
            )
        )
    if movement_type:
        stmt = stmt.where(StockLedger.movement_type == movement_type)
    if operation_id is not None:
        stmt = stmt.where(StockLedger.operation_id == operation_id)
    if search:
        stmt = stmt.where(
            StockLedger.product_id.in_(
                select(Product.id).where(
                    Product.sku.icontains(search, autoescape=True)
                    | Product.name.icontains(search, autoescape=True)
                )
            )
            | StockLedger.operation_id.in_(
                select(Operation.id).where(Operation.reference.icontains(search, autoescape=True))
            )
        )
    if date_from:
        stmt = stmt.where(StockLedger.created_at >= date_from)
    if date_to:
        stmt = stmt.where(StockLedger.created_at < date_to + timedelta(days=1))
    return stmt


def list_ledger(db: Session, paging: PageParams, **filters) -> Page[LedgerEntryOut]:
    rows, total = paginate(db, ledger_query(**filters), paging)
    return Page(
        items=[ledger_entry_out(r[0]) for r in rows],
        total=total,
        page=paging.page,
        page_size=paging.page_size,
    )


CSV_EXPORT_LIMIT = 50_000
_CSV_COLUMNS = [
    "timestamp_utc",
    "reference",
    "movement_type",
    "sku",
    "product",
    "uom",
    "location",
    "from_to",
    "quantity_delta",
    "balance_after",
    "user",
]


def _cell(value: str) -> str:
    """Neutralize spreadsheet formula injection (=, +, -, @) in user-entered text."""
    return f"'{value}" if value[:1] in ("=", "+", "-", "@", "\t", "\r") else value


def export_ledger_csv(db: Session, **filters) -> str:
    """Move history as CSV (same filters as the list)."""
    # ponytail: built in memory and capped at CSV_EXPORT_LIMIT rows; stream it if exports grow.
    rows = db.scalars(ledger_query(**filters).limit(CSV_EXPORT_LIMIT))
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(_CSV_COLUMNS)
    for e in rows:
        entry = ledger_entry_out(e)
        writer.writerow(
            [
                entry.created_at.isoformat(),
                entry.reference,
                entry.movement_type,
                _cell(entry.sku),
                _cell(entry.product_name),
                entry.uom,
                _cell(entry.location_name),
                _cell(entry.counterpart_location_name or ""),
                f"{entry.quantity_delta:.3f}",
                f"{entry.balance_after:.3f}",
                _cell(entry.created_by.name),
            ]
        )
    return buf.getvalue()


_INTEGRITY_SQL = text(
    """
    WITH l AS (
        SELECT product_id, location_id, SUM(quantity_delta) AS ledger_sum
        FROM stock_ledger GROUP BY product_id, location_id
    )
    SELECT COALESCE(b.product_id, l.product_id)   AS product_id,
           COALESCE(b.location_id, l.location_id) AS location_id,
           COALESCE(b.quantity, 0)                AS balance,
           COALESCE(l.ledger_sum, 0)              AS ledger_sum
    FROM stock_balances b
    FULL OUTER JOIN l ON l.product_id = b.product_id AND l.location_id = b.location_id
    WHERE COALESCE(b.quantity, 0) <> COALESCE(l.ledger_sum, 0)
    """
)


def integrity(db: Session) -> IntegrityOut:
    """Proof that every balance equals the sum of its ledger movements."""
    mismatches = [IntegrityMismatch(**row._mapping) for row in db.execute(_INTEGRITY_SQL)]
    checked = db.scalar(select(func.count()).select_from(StockBalance)) or 0
    return IntegrityOut(ok=not mismatches, checked=checked, mismatches=mismatches)
