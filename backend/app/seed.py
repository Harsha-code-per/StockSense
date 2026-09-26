"""Demo data. Usage: python -m app.seed [--reset]

--reset wipes ALL data first (local/dev only). Without it, seeding is skipped if users exist.
"""

import argparse
from decimal import Decimal

from sqlalchemy import select, text

from app.database import SessionLocal
from app.models import Base, Category, Location, Product, User, Warehouse
from app.security import hash_password

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
    print("Seeded: 2 users, 2 warehouses (5 locations), 3 categories, 5 products.")
    print("Login: manager@stocksense.dev / Manager@123 · staff@stocksense.dev / Staff@123")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed StockSense demo data.")
    parser.add_argument("--reset", action="store_true", help="wipe all data first (dev only)")
    seed(parser.parse_args().reset)
