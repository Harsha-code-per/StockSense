"""Demo data. Usage: python -m app.seed [--reset]

--reset wipes ALL data first (local/dev only). Without it, seeding is skipped if users exist.
Opening stock goes through the operation engine (validated adjustments), so it has ledger
evidence like every other stock change.
"""

import argparse
from decimal import Decimal

from sqlalchemy import select, text

from app.database import SessionLocal
from app.models import Base, Category, Location, Product, User, Warehouse
from app.schemas.operation import LineIn, OperationCreate
from app.security import hash_password
from app.services import operation_service

USERS = [
    ("Asha Manager", "manager@stocksense.dev", "Manager@123", "manager"),
    ("Ravi Staff", "staff@stocksense.dev", "Staff@123", "staff"),
]
WAREHOUSES = [
    (
        "WH",
        "Main Warehouse",
        "Plot 4, Industrial Area, Jalandhar",
        ["Stock", "Rack A", "Rack B", "Production Floor"],
    ),
    ("WH2", "Secondary Warehouse", "Phagwara Road, Jalandhar", ["Stock"]),
]
CATEGORIES = ["Raw Material", "Furniture", "Components"]
# sku, name, category, uom, min, max
PRODUCTS = [
    ("STL001", "Steel Rod", "Raw Material", "kg", "20", "200"),
    ("CHR001", "Office Chair", "Furniture", "unit", "5", "50"),
    ("BRG001", "Bearing", "Components", "unit", "50", "500"),
    ("MTR001", "Motor", "Components", "unit", "5", "40"),
    ("ALU001", "Aluminium Sheet", "Raw Material", "kg", "30", "300"),
]
# Opening stock (sku, location, qty). STL001 and MTR001 start empty: Steel Rod is the live
# demo, Motor shows "out of stock". Bearing 30 < min 50 shows "low stock".
OPENING_STOCK = [
    ("CHR001", "WH/Stock", "20"),
    ("BRG001", "WH/Rack A", "30"),
    ("ALU001", "WH/Rack B", "120"),
]


def _reset(db) -> None:
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    db.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    db.commit()


def seed(reset: bool = False) -> None:
    with SessionLocal() as db:
        if reset:
            _reset(db)
        elif db.scalar(select(User.id).limit(1)) is not None:
            print("Database already has data; skipping. Use --reset to wipe and reseed.")
            return

        db.add_all(
            User(name=n, email=e, password_hash=hash_password(p), role=r) for n, e, p, r in USERS
        )
        for code, name, address, locations in WAREHOUSES:
            wh = Warehouse(code=code, name=name, address=address)
            wh.locations = [Location(name=loc) for loc in locations]
            db.add(wh)
        categories = {name: Category(name=name) for name in CATEGORIES}
        db.add_all(categories.values())
        db.add_all(
            Product(
                sku=sku,
                name=name,
                category=categories[cat],
                uom=uom,
                min_qty=Decimal(mn),
                max_qty=Decimal(mx),
            )
            for sku, name, cat, uom, mn, mx in PRODUCTS
        )
        db.commit()

        manager = db.scalar(select(User).where(User.role == "manager"))
        loc = {l.full_name: l.id for l in db.scalars(select(Location))}  # noqa: E741
        prod = {p.sku: p.id for p in db.scalars(select(Product))}

        def post(data: OperationCreate, validate: bool = False, confirm: bool = False):
            op = operation_service.build_operation(db, data, manager)
            if validate:
                operation_service.apply_stock(db, op, manager)
            db.commit()
            if confirm:
                operation_service.confirm(db, op.id, manager)

        for sku, location, qty in OPENING_STOCK:
            post(
                OperationCreate(
                    type="adjustment",
                    source_location_id=loc[location],
                    notes="Opening stock",
                    lines=[LineIn(product_id=prod[sku], counted_quantity=Decimal(qty))],
                ),
                validate=True,
            )
        # Open documents so dashboard KPIs and filters show real data.
        post(
            OperationCreate(
                type="receipt",
                destination_location_id=loc["WH/Stock"],
                partner_name="Hindalco Industries",
                lines=[LineIn(product_id=prod["ALU001"], quantity=Decimal("80"))],
            ),
            confirm=True,
        )  # -> ready
        post(
            OperationCreate(
                type="delivery",
                source_location_id=loc["WH/Stock"],
                partner_name="Sharma Engineering Works",
                lines=[LineIn(product_id=prod["MTR001"], quantity=Decimal("4"))],
            ),
            confirm=True,
        )  # -> waiting (no motors in stock)
        post(
            OperationCreate(
                type="transfer",
                source_location_id=loc["WH/Stock"],
                destination_location_id=loc["WH2/Stock"],
                lines=[LineIn(product_id=prod["CHR001"], quantity=Decimal("5"))],
            )
        )  # draft
    print("Seeded: 2 users, 2 warehouses (5 locations), 3 categories, 5 products,")
    print("        opening stock (3 adjustments) and 3 open operations (ready/waiting/draft).")
    print("Login: manager@stocksense.dev / Manager@123 · staff@stocksense.dev / Staff@123")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed StockSense demo data.")
    parser.add_argument("--reset", action="store_true", help="wipe all data first (dev only)")
    seed(parser.parse_args().reset)
