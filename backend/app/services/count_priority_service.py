"""Which product-locations should staff physically count next?

A transparent rule score, not a trained model (see docs/ROADMAP.md, "Explainable cycle-count
priority"). Each factor is normalized to 0..1 and capped, so one extreme value can't dominate:

  score = 100 * (0.40 * movements since last count / 20
               + 0.35 * days since last count      / 30
               + 0.25 * past count discrepancies   / 3)

More handling, more time without verification, and a history of mismatches all make a record
more likely to be wrong. Every result carries the human-readable reasons behind its score.
"""

from datetime import UTC, datetime

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, contains_eager

from app.models import Location, Operation, OperationLine, Product, StockBalance, StockLedger
from app.schemas.inventory import CountPriorityItem

WEIGHTS = {"movements": 0.40, "days": 0.35, "discrepancies": 0.25}
CAPS = {"movements": 20, "days": 30, "discrepancies": 3}


def _norm(value: float, cap: float) -> float:
    return min(value / cap, 1.0)


def score(movements: int, days: int, discrepancies: int) -> int:
    raw = (
        WEIGHTS["movements"] * _norm(movements, CAPS["movements"])
        + WEIGHTS["days"] * _norm(days, CAPS["days"])
        + WEIGHTS["discrepancies"] * _norm(discrepancies, CAPS["discrepancies"])
    )
    return round(raw * 100)


def level(value: int) -> str:
    return "high" if value >= 60 else "medium" if value >= 30 else "low"


def reasons(movements: int, days: int, never_counted: bool, discrepancies: int) -> list[str]:
    out = []
    if never_counted:
        out.append(f"Never counted (first movement {days} day{'s' * (days != 1)} ago)")
    elif days:
        out.append(f"{days} day{'s' * (days != 1)} since last count")
    if movements:
        out.append(f"{movements} movement{'s' * (movements != 1)} since last count")
    if discrepancies:
        out.append(f"{discrepancies} past count discrepanc{'ies' if discrepancies != 1 else 'y'}")
    return out or ["Recently counted, no movements since"]


def count_priority(
    db: Session, *, warehouse_id: int | None = None, limit: int = 20
) -> list[CountPriorityItem]:
    b = StockBalance
    adjustment_lines = (
        select(OperationLine.id)
        .join(Operation, Operation.id == OperationLine.operation_id)
        .where(
            Operation.type == "adjustment",
            Operation.status == "done",
            Operation.source_location_id == b.location_id,
            OperationLine.product_id == b.product_id,
        )
    )
    last_count = (
        select(func.max(Operation.validated_at))
        .join(OperationLine, OperationLine.operation_id == Operation.id)
        .where(
            Operation.type == "adjustment",
            Operation.status == "done",
            Operation.source_location_id == b.location_id,
            OperationLine.product_id == b.product_id,
        )
        .correlate(b)
        .scalar_subquery()
    )
    # A "discrepancy" is a real recount that disagreed with the books. Opening stock
    # (system quantity 0) is excluded; it's a first count, not a mismatch.
    discrepancies = (
        select(func.count())
        .select_from(OperationLine)
        .where(
            OperationLine.id.in_(adjustment_lines.correlate(b)),
            OperationLine.system_quantity > 0,
            OperationLine.counted_quantity != OperationLine.system_quantity,
        )
        .correlate(b)
        .scalar_subquery()
    )
    ledger_here = and_(
        StockLedger.product_id == b.product_id, StockLedger.location_id == b.location_id
    )
    first_move = (
        select(func.min(StockLedger.created_at)).where(ledger_here).correlate(b).scalar_subquery()
    )
    moves_since = (
        select(func.count())
        .select_from(StockLedger)
        .where(
            ledger_here,
            StockLedger.movement_type != "adjustment",
            StockLedger.created_at > func.coalesce(last_count, datetime.min.replace(tzinfo=UTC)),
        )
        .correlate(b)
        .scalar_subquery()
    )
    stmt = (
        select(b, last_count, first_move, moves_since, discrepancies)
        .join(b.product)
        .join(b.location)
        .options(contains_eager(b.product), contains_eager(b.location))
        .where(Product.is_active, Location.is_active, first_move.is_not(None))
    )
    if warehouse_id is not None:
        stmt = stmt.where(Location.warehouse_id == warehouse_id)

    now = datetime.now(UTC)
    items = []
    for bal, last, first, moves, disc in db.execute(stmt):
        since = last or first
        days = max((now - since).days, 0)
        s = score(moves, days, disc)
        items.append(
            CountPriorityItem(
                product_id=bal.product_id,
                sku=bal.product.sku,
                product_name=bal.product.name,
                uom=bal.product.uom,
                location_id=bal.location_id,
                location_name=bal.location.full_name,
                quantity=bal.quantity,
                last_counted_at=last,
                days_since_count=days,
                movements_since_count=moves,
                past_discrepancies=disc,
                score=s,
                level=level(s),
                reasons=reasons(moves, days, last is None, disc),
            )
        )
    items.sort(key=lambda i: (-i.score, -i.movements_since_count, i.sku))
    return items[:limit]
