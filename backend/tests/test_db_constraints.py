"""The database itself rejects corrupt stock data, even if app code has a bug."""

from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.models import (
    Location,
    Operation,
    OperationLine,
    Product,
    StockBalance,
    StockLedger,
    User,
    Warehouse,
)


@pytest.fixture
def world(db):
    user = User(email="m@x.dev", name="M", password_hash="x", role="manager")
    wh = Warehouse(code="WH", name="Main")
    db.add_all([user, wh])
    db.flush()
    loc = Location(warehouse_id=wh.id, name="Stock")
    product = Product(sku="STL001", name="Steel Rod", uom="kg")
    db.add_all([loc, product])
    db.commit()
    return user, wh, loc, product


def test_negative_balance_rejected(db, world):
    _, _, loc, product = world
    db.add(StockBalance(product_id=product.id, location_id=loc.id, quantity=Decimal("-1")))
    with pytest.raises(IntegrityError, match="ck_stock_balances_quantity_non_negative"):
        db.commit()


def test_operation_location_shape_enforced(db, world):
    user, wh, loc, _ = world
    # A receipt must have a destination and no source.
    db.add(
        Operation(
            reference="WH/IN/0001",
            type="receipt",
            warehouse_id=wh.id,
            source_location_id=loc.id,
            created_by=user.id,
        )
    )
    with pytest.raises(IntegrityError, match="ck_operations_locations_by_type"):
        db.commit()


def test_line_needs_exactly_one_quantity_kind(db, world):
    user, wh, loc, product = world
    op = Operation(
        reference="WH/IN/0001",
        type="receipt",
        warehouse_id=wh.id,
        destination_location_id=loc.id,
        created_by=user.id,
    )
    op.lines.append(
        OperationLine(product_id=product.id, quantity=Decimal("1"), counted_quantity=Decimal("1"))
    )
    db.add(op)
    with pytest.raises(IntegrityError, match="ck_operation_lines_one_quantity_kind"):
        db.commit()


def test_sku_format_enforced(db):
    db.add(Product(sku="bad sku", name="x", uom="kg"))
    with pytest.raises(IntegrityError, match="ck_products_sku_format"):
        db.commit()


def test_ledger_is_append_only(db, world):
    user, wh, loc, product = world
    op = Operation(
        reference="WH/IN/0001",
        type="receipt",
        warehouse_id=wh.id,
        destination_location_id=loc.id,
        created_by=user.id,
    )
    line = OperationLine(product_id=product.id, quantity=Decimal("5"))
    op.lines.append(line)
    db.add(op)
    db.flush()
    db.add(
        StockLedger(
            operation_id=op.id,
            operation_line_id=line.id,
            product_id=product.id,
            location_id=loc.id,
            movement_type="receipt",
            quantity_delta=Decimal("5"),
            balance_after=Decimal("5"),
            created_by=user.id,
        )
    )
    db.commit()

    for stmt in ("UPDATE stock_ledger SET quantity_delta = 50", "DELETE FROM stock_ledger"):
        with pytest.raises(DBAPIError, match="append-only"):
            db.execute(text(stmt))
        db.rollback()
