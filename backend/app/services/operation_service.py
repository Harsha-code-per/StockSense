"""The stock engine. The ONLY code that writes stock_balances and stock_ledger.

Every validation runs in one transaction:
  lock operation row -> lock balance rows (sorted, deadlock-free) -> check all lines ->
  apply balances + append ledger -> mark done -> commit.
Any failure rolls everything back. See docs/INVENTORY_RULES.md.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import get_args

from sqlalchemy import Select, func, select, tuple_, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.enums import OPEN_STATUSES, REFERENCE_PREFIX, OperationStatus
from app.errors import (
    Forbidden,
    InsufficientStock,
    InvalidState,
    NotFound,
    SameLocation,
    ValidationFailed,
    field_error,
)
from app.models import (
    Location,
    Operation,
    OperationLine,
    OperationSequence,
    Product,
    StockBalance,
    StockLedger,
    User,
)
from app.schemas.common import LocationRef, Page, PageParams, UserRef
from app.schemas.operation import (
    LineIn,
    LineOut,
    OperationCreate,
    OperationOut,
    OperationSummary,
    OperationUpdate,
    StockEffect,
    ValidateResult,
)
from app.services.common import paginate

ZERO = Decimal("0")
_STATUSES = set(get_args(OperationStatus))

# ---------------------------------------------------------------- input validation


def _location(db: Session, location_id: int | None, field: str, missing: str) -> Location | None:
    if location_id is None:
        raise field_error(field, missing)
    loc = db.get(Location, location_id)
    if loc is None or not loc.is_active or not loc.warehouse.is_active:
        raise field_error(field, "Location not found or inactive.")
    return loc


def _resolve_locations(
    db: Session, op_type: str, source_id: int | None, dest_id: int | None
) -> tuple[Location | None, Location | None]:
    """Enforce the location shape per operation type with friendly field errors."""
    src = dst = None
    if op_type in ("delivery", "transfer", "adjustment"):
        missing = {
            "delivery": "Choose the location the goods ship from.",
            "transfer": "Choose the source location.",
            "adjustment": "Choose the location you counted.",
        }[op_type]
        src = _location(db, source_id, "source_location_id", missing)
    elif source_id is not None:
        raise field_error("source_location_id", "Receipts don't have a source location.")

    if op_type in ("receipt", "transfer"):
        missing = {
            "receipt": "Choose where the goods are received.",
            "transfer": "Choose the destination location.",
        }[op_type]
        dst = _location(db, dest_id, "destination_location_id", missing)
    elif dest_id is not None:
        raise field_error(
            "destination_location_id", f"{op_type.title()}s don't have a destination location."
        )

    if op_type == "transfer" and src.id == dst.id:
        msg = "Source and destination must be different locations."
        raise SameLocation(msg, field_errors=[{"field": "destination_location_id", "message": msg}])
    return src, dst


def _build_lines(db: Session, op_type: str, lines: list[LineIn]) -> list[OperationLine]:
    errors: list[dict] = []
    seen: set[int] = set()
    for i, line in enumerate(lines):
        product = db.get(Product, line.product_id)
        if product is None or not product.is_active:
            errors.append(
                {"field": f"lines.{i}.product_id", "message": "Product not found or inactive."}
            )
        elif line.product_id in seen:
            errors.append(
                {
                    "field": f"lines.{i}.product_id",
                    "message": "This product is already on another line.",
                }
            )
        seen.add(line.product_id)

        if op_type == "adjustment":
            if line.counted_quantity is None:
                errors.append(
                    {
                        "field": f"lines.{i}.counted_quantity",
                        "message": "Enter the counted quantity.",
                    }
                )
        elif line.quantity is None:
            errors.append(
                {"field": f"lines.{i}.quantity", "message": "Quantity must be greater than 0."}
            )
    if errors:
        raise ValidationFailed("Please fix the highlighted lines.", field_errors=errors)

    if op_type == "adjustment":
        return [
            OperationLine(product_id=ln.product_id, counted_quantity=ln.counted_quantity)
            for ln in lines
        ]
    return [OperationLine(product_id=ln.product_id, quantity=ln.quantity) for ln in lines]


def _next_reference(db: Session, warehouse_id: int, warehouse_code: str, op_type: str) -> str:
    """WH/IN/0001. The UPDATE takes a row lock, so concurrent creators never share a number."""
    db.execute(
        pg_insert(OperationSequence)
        .values(warehouse_id=warehouse_id, type=op_type)
        .on_conflict_do_nothing()
    )
    n = db.scalar(
        update(OperationSequence)
        .where(OperationSequence.warehouse_id == warehouse_id, OperationSequence.type == op_type)
        .values(next_value=OperationSequence.next_value + 1)
        .returning(OperationSequence.next_value - 1)
    )
    return f"{warehouse_code}/{REFERENCE_PREFIX[op_type]}/{n:04d}"


# ---------------------------------------------------------------- read models


def _available_map(db: Session, pairs: set[tuple[int, int]]) -> dict[tuple[int, int], Decimal]:
    if not pairs:
        return {}
    rows = db.execute(
        select(StockBalance.product_id, StockBalance.location_id, StockBalance.quantity).where(
            tuple_(StockBalance.product_id, StockBalance.location_id).in_(pairs)
        )
    )
    return {(p, loc): q for p, loc, q in rows}


def _loc_ref(loc: Location | None) -> LocationRef | None:
    return LocationRef(id=loc.id, full_name=loc.full_name) if loc else None


def _user_ref(user: User | None) -> UserRef | None:
    return UserRef(id=user.id, name=user.name) if user else None


def operation_out(db: Session, op: Operation) -> OperationOut:
    stock_loc_id = op.source_location_id or op.destination_location_id
    available = _available_map(db, {(ln.product_id, stock_loc_id) for ln in op.lines})
    return OperationOut(
        id=op.id,
        reference=op.reference,
        type=op.type,
        status=op.status,
        warehouse_id=op.warehouse_id,
        source_location=_loc_ref(op.source_location),
        destination_location=_loc_ref(op.destination_location),
        partner_name=op.partner_name,
        scheduled_date=op.scheduled_date,
        notes=op.notes,
        lines=[
            LineOut(
                id=ln.id,
                product_id=ln.product_id,
                sku=ln.product.sku,
                product_name=ln.product.name,
                uom=ln.product.uom,
                quantity=ln.quantity,
                counted_quantity=ln.counted_quantity,
                system_quantity=ln.system_quantity,
                available=available.get((ln.product_id, stock_loc_id), ZERO),
            )
            for ln in op.lines
        ],
        created_by=_user_ref(op.creator),
        validated_by=_user_ref(op.validator),
        created_at=op.created_at,
        validated_at=op.validated_at,
        canceled_at=op.canceled_at,
    )


def list_operations(
    db: Session,
    paging: PageParams,
    *,
    type: str | None = None,
    status: str | None = None,
    warehouse_id: int | None = None,
    location_id: int | None = None,
    category_id: int | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> Page[OperationSummary]:
    line_count = (
        select(func.count(OperationLine.id))
        .where(OperationLine.operation_id == Operation.id)
        .correlate(Operation)
        .scalar_subquery()
    )
    stmt: Select = select(Operation, line_count).order_by(
        Operation.created_at.desc(), Operation.id.desc()
    )
    if type:
        stmt = stmt.where(Operation.type == type)
    if status:
        statuses = {s.strip() for s in status.split(",") if s.strip()}
        if not statuses <= _STATUSES:
            raise field_error("status", f"Unknown status. Use: {', '.join(sorted(_STATUSES))}.")
        stmt = stmt.where(Operation.status.in_(statuses))
    if warehouse_id is not None:
        stmt = stmt.where(Operation.warehouse_id == warehouse_id)
    if location_id is not None:
        stmt = stmt.where(
            (Operation.source_location_id == location_id)
            | (Operation.destination_location_id == location_id)
        )
    if category_id is not None:
        stmt = stmt.where(
            select(OperationLine.id)
            .join(OperationLine.product)
            .where(OperationLine.operation_id == Operation.id, Product.category_id == category_id)
            .exists()
        )
    if search:
        stmt = stmt.where(
            Operation.reference.icontains(search, autoescape=True)
            | Operation.partner_name.icontains(search, autoescape=True)
        )
    if date_from:
        stmt = stmt.where(Operation.created_at >= date_from)
    if date_to:
        stmt = stmt.where(Operation.created_at < date_to + timedelta(days=1))

    rows, total = paginate(db, stmt, paging)
    items = [
        OperationSummary(
            id=op.id,
            reference=op.reference,
            type=op.type,
            status=op.status,
            partner_name=op.partner_name,
            source_location=_loc_ref(op.source_location),
            destination_location=_loc_ref(op.destination_location),
            scheduled_date=op.scheduled_date,
            line_count=count,
            created_at=op.created_at,
            validated_at=op.validated_at,
        )
        for op, count in rows
    ]
    return Page(items=items, total=total, page=paging.page, page_size=paging.page_size)


def _get(db: Session, operation_id: int, *, lock: bool = False) -> Operation:
    stmt = select(Operation).where(Operation.id == operation_id)
    if lock:
        # Serializes concurrent confirm/validate/cancel on the same operation (double clicks).
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    op = db.scalar(stmt)
    if op is None:
        raise NotFound("Operation not found.", {"id": operation_id})
    return op


def get_operation(db: Session, operation_id: int) -> OperationOut:
    return operation_out(db, _get(db, operation_id))


# ---------------------------------------------------------------- create / edit


def build_operation(db: Session, data: OperationCreate, user: User) -> Operation:
    """Create a draft (flush only; caller commits). Used by the API and by initial stock."""
    src, dst = _resolve_locations(
        db, data.type, data.source_location_id, data.destination_location_id
    )
    lines = _build_lines(db, data.type, data.lines)
    warehouse = (dst if data.type == "receipt" else src).warehouse
    op = Operation(
        reference=_next_reference(db, warehouse.id, warehouse.code, data.type),
        type=data.type,
        warehouse_id=warehouse.id,
        source_location_id=src.id if src else None,
        destination_location_id=dst.id if dst else None,
        partner_name=data.partner_name,
        scheduled_date=data.scheduled_date,
        notes=data.notes,
        created_by=user.id,
        lines=lines,
    )
    db.add(op)
    db.flush()
    return op


def create_operation(db: Session, data: OperationCreate, user: User) -> OperationOut:
    op = build_operation(db, data, user)
    db.commit()
    return operation_out(db, op)


def update_operation(
    db: Session, operation_id: int, data: OperationUpdate, user: User
) -> OperationOut:
    op = _get(db, operation_id, lock=True)
    if op.status != "draft":
        raise InvalidState("Only draft operations can be edited.", {"status": op.status})
    changes = data.model_dump(exclude_unset=True)

    src_id = changes.get("source_location_id", op.source_location_id)
    dst_id = changes.get("destination_location_id", op.destination_location_id)
    src, dst = _resolve_locations(db, op.type, src_id, dst_id)
    op.source_location_id = src.id if src else None
    op.destination_location_id = dst.id if dst else None
    op.warehouse_id = (dst if op.type == "receipt" else src).warehouse_id
    for field in ("partner_name", "scheduled_date", "notes"):
        if field in changes:
            setattr(op, field, changes[field])
    if data.lines is not None:
        new_lines = _build_lines(db, op.type, data.lines)
        op.lines.clear()
        db.flush()  # delete old lines before inserting new ones (unique operation_id+product_id)
        op.lines.extend(new_lines)
    db.commit()
    return operation_out(db, op)


# ---------------------------------------------------------------- state changes


def _shortages(op: Operation, balances: dict[tuple[int, int], Decimal]) -> list[dict]:
    """Lines whose source doesn't hold enough stock (deliveries and transfers only)."""
    if op.type not in ("delivery", "transfer"):
        return []
    short = []
    for ln in op.lines:
        have = balances.get((ln.product_id, op.source_location_id), ZERO)
        if have < ln.quantity:
            short.append(
                {
                    "line_id": ln.id,
                    "product_id": ln.product_id,
                    "sku": ln.product.sku,
                    "available": f"{have:.3f}",
                    "requested": f"{ln.quantity:.3f}",
                }
            )
    return short


def confirm(db: Session, operation_id: int, user: User) -> OperationOut:
    """Availability check: ready if every line can be fulfilled now, else waiting."""
    op = _get(db, operation_id, lock=True)
    if op.status not in OPEN_STATUSES:
        raise InvalidState(f"A {op.status} operation can't be confirmed.", {"status": op.status})
    pairs = {(ln.product_id, op.source_location_id) for ln in op.lines}
    op.status = "waiting" if _shortages(op, _available_map(db, pairs)) else "ready"
    db.commit()
    return operation_out(db, op)


@dataclass
class _Move:
    line: OperationLine
    location_id: int
    delta: Decimal
    counterpart_id: int | None = None


def _planned_moves(op: Operation, balances: dict[tuple[int, int], StockBalance]) -> list[_Move]:
    moves: list[_Move] = []
    for ln in op.lines:
        src, dst = op.source_location_id, op.destination_location_id
        if op.type == "receipt":
            moves.append(_Move(ln, dst, ln.quantity))
        elif op.type == "delivery":
            moves.append(_Move(ln, src, -ln.quantity))
        elif op.type == "transfer":
            moves.append(_Move(ln, src, -ln.quantity, dst))
            moves.append(_Move(ln, dst, ln.quantity, src))
        else:  # adjustment: set stock to the physical count
            system = balances[(ln.product_id, src)].quantity
            ln.system_quantity = system
            if ln.counted_quantity != system:
                moves.append(_Move(ln, src, ln.counted_quantity - system))
    return moves


def apply_stock(db: Session, op: Operation, user: User) -> list[StockEffect]:
    """Lock balances, check, apply, append ledger, mark done. Flush only; caller commits.

    Raises InsufficientStock listing EVERY short line; the caller's rollback undoes everything.
    """
    for ln in op.lines:
        if not ln.product.is_active:
            raise ValidationFailed(
                f"Product {ln.product.sku} is inactive.", {"product_id": ln.product_id}
            )
    for loc in (op.source_location, op.destination_location):
        if loc is not None and not loc.is_active:
            raise ValidationFailed(
                f"Location {loc.full_name} is inactive.", {"location_id": loc.id}
            )

    keys = sorted(
        {
            (ln.product_id, loc)
            for ln in op.lines
            for loc in (op.source_location_id, op.destination_location_id)
            if loc
        }
    )
    db.execute(
        pg_insert(StockBalance)
        .values([{"product_id": p, "location_id": loc} for p, loc in keys])
        .on_conflict_do_nothing()
    )
    locked = db.scalars(
        select(StockBalance)
        .where(tuple_(StockBalance.product_id, StockBalance.location_id).in_(keys))
        .order_by(
            StockBalance.product_id, StockBalance.location_id
        )  # same order everywhere: no deadlocks
        .with_for_update(of=StockBalance)
        .execution_options(populate_existing=True)
    ).all()
    balances = {(b.product_id, b.location_id): b for b in locked}

    shortages = _shortages(op, {k: b.quantity for k, b in balances.items()})
    if shortages:
        n = len(shortages)
        raise InsufficientStock(
            f"Not enough stock for {n} line{'s' if n > 1 else ''}.", {"lines": shortages}
        )

    effects: list[StockEffect] = []
    for mv in _planned_moves(op, balances):
        bal = balances[(mv.line.product_id, mv.location_id)]
        bal.quantity += mv.delta
        db.add(
            StockLedger(
                operation_id=op.id,
                operation_line_id=mv.line.id,
                product_id=mv.line.product_id,
                location_id=mv.location_id,
                counterpart_location_id=mv.counterpart_id,
                movement_type=op.type,
                quantity_delta=mv.delta,
                balance_after=bal.quantity,
                created_by=user.id,
            )
        )
        effects.append(
            StockEffect(
                product_id=mv.line.product_id,
                sku=mv.line.product.sku,
                location_id=mv.location_id,
                location_name=bal.location.full_name,
                quantity_delta=mv.delta,
                balance_after=bal.quantity,
            )
        )

    op.status = "done"
    op.validated_by = user.id
    op.validated_at = datetime.now(UTC)
    db.flush()
    return effects


def validate(db: Session, operation_id: int, user: User) -> ValidateResult:
    op = _get(db, operation_id, lock=True)
    if op.status == "done":
        # Idempotent: a retry or double click never moves stock twice.
        db.commit()
        return ValidateResult(
            **operation_out(db, op).model_dump(), already_done=True, stock_effects=[]
        )
    if op.status == "canceled":
        raise InvalidState("A canceled operation can't be validated.", {"status": op.status})
    if op.type == "adjustment" and user.role != "manager":
        raise Forbidden("Only managers can validate inventory adjustments.")
    try:
        effects = apply_stock(db, op, user)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(op)
    return ValidateResult(
        **operation_out(db, op).model_dump(), already_done=False, stock_effects=effects
    )


def cancel(db: Session, operation_id: int, user: User) -> OperationOut:
    op = _get(db, operation_id, lock=True)
    if op.status == "done":
        raise InvalidState(
            "Done operations can't be canceled. Post an adjustment to correct stock.",
            {"status": op.status},
        )
    if op.status != "canceled":
        op.status = "canceled"
        op.canceled_at = datetime.now(UTC)
    db.commit()
    return operation_out(db, op)
