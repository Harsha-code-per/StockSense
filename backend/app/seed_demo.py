"""Rich demo data: two weeks of warehouse activity. Usage: python -m app.seed_demo --yes

WIPES ALL DATA, then builds a realistic business on top of the real operation engine:
every stock change is a validated operation with ledger evidence, so the integrity check
holds exactly. Steel Rod (STL001) is left empty with no history for the live demo story.

Simulated history: the engine stamps records with the current time, so after building the
history this loader re-dates the finished records across the last 14 days. Only timestamps
change (quantities and balances are exactly what the engine produced); the ledger's
append-only trigger is disabled for that single UPDATE inside the seeding transaction and
re-enabled before commit. The running application never does this.
"""

import argparse
import random
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select, text

from app.database import SessionLocal
from app.errors import InsufficientStock
from app.models import Category, Location, Product, StockBalance, User, Warehouse
from app.schemas.operation import LineIn, OperationCreate
from app.security import hash_password
from app.seed import _reset
from app.services import operation_service

IST = ZoneInfo("Asia/Kolkata")
USERS = [
    ("Asha Manager", "manager@stocksense.dev", "Manager@123", "manager"),
    ("Ravi Staff", "staff@stocksense.dev", "Staff@123", "staff"),
    ("Priya Nair", "priya@stocksense.dev", "Staff@123", "staff"),
    ("Imran Sheikh", "imran@stocksense.dev", "Staff@123", "staff"),
]
WAREHOUSES = [
    (
        "WH",
        "Main Warehouse",
        "Plot 4, Industrial Area, Jalandhar",
        ["Stock", "Rack A", "Rack B", "Production Floor", "Dispatch Bay"],
    ),
    ("WH2", "Secondary Warehouse", "Phagwara Road, Jalandhar", ["Stock", "Cold Room"]),
    ("LDH", "Ludhiana Hub", "Focal Point, Ludhiana", ["Stock", "Rack A"]),
]
CATEGORIES = ["Raw Material", "Components", "Electrical", "Furniture", "Packaging", "Consumables"]
# sku, name, category, uom, min, max, home location, role in the story
PRODUCTS = [
    ("STL001", "Steel Rod", "Raw Material", "kg", 20, 200, "WH/Stock", "demo"),
    ("ALU001", "Aluminium Sheet", "Raw Material", "kg", 30, 300, "WH/Rack B", ""),
    ("CPR001", "Copper Wire Coil", "Raw Material", "kg", 25, 250, "WH/Rack B", ""),
    ("PVC001", "PVC Pipe 2 in", "Raw Material", "m", 100, 800, "WH/Stock", ""),
    ("BRG001", "Bearing 6204", "Components", "unit", 50, 500, "WH/Rack A", "low"),
    ("MTR001", "Motor 1 HP", "Components", "unit", 5, 40, "WH/Stock", "never"),
    ("BLT001", "Hex Bolt M10", "Components", "box", 20, 200, "WH/Rack A", ""),
    ("SWT001", "Rotary Switch", "Electrical", "unit", 30, 300, "WH/Rack A", "low"),
    ("LED001", "LED Panel 40W", "Electrical", "unit", 20, 150, "WH2/Stock", ""),
    ("CBL001", "Power Cable 4 mm", "Electrical", "m", 200, 1500, "WH/Stock", ""),
    ("CHR001", "Office Chair", "Furniture", "unit", 5, 50, "WH/Stock", ""),
    ("DSK001", "Work Desk", "Furniture", "unit", 3, 20, "WH2/Stock", ""),
    ("SHF001", "Steel Shelf Unit", "Furniture", "unit", 4, 30, "LDH/Stock", ""),
    ("BOX001", "Corrugated Box L", "Packaging", "box", 100, 1000, "LDH/Stock", ""),
    ("TAP001", "Packing Tape Roll", "Packaging", "unit", 50, 400, "LDH/Stock", "low"),
    ("GLV001", "Safety Gloves", "Consumables", "box", 20, 150, "WH/Dispatch Bay", ""),
    ("GRS001", "Industrial Grease", "Consumables", "kg", 10, 80, "WH2/Stock", ""),
    ("PNT001", "Epoxy Paint 20 L", "Consumables", "l", 40, 200, "WH2/Cold Room", ""),
    ("SND001", "Sanding Disc", "Consumables", "box", 15, 100, "WH/Rack B", ""),
    ("FLT001", "Air Filter", "Components", "unit", 10, 60, "LDH/Rack A", "out"),
]
VENDORS = [
    "Tata Steel",
    "Hindalco Industries",
    "Polycab Wires",
    "SKF India",
    "Havells India",
    "Supreme Industries",
    "Godrej Interio",
    "Asian Paints",
    "3M India",
]
CUSTOMERS = [
    "Sharma Engineering Works",
    "Mehta Fabricators",
    "Punjab Tractors",
    "Kapoor Furnishings",
    "Bharat Electricals",
    "Singh Auto Parts",
]
# Where stock tends to move internally
TRANSFER_ROUTES = [
    ("WH/Stock", "WH/Production Floor"),
    ("WH/Rack A", "WH/Dispatch Bay"),
    ("WH/Rack B", "WH/Production Floor"),
    ("WH/Stock", "WH2/Stock"),
    ("WH2/Stock", "LDH/Stock"),
    ("WH/Stock", "WH/Dispatch Bay"),
]
DAYS = 14


def _q(x: float, uom: str) -> Decimal:
    """Whole numbers for countable units, one decimal for kg / m / l."""
    return Decimal(str(round(x))) if uom in ("unit", "box") else Decimal(str(round(x, 1)))


def seed_demo() -> None:
    rnd = random.Random(26)
    with SessionLocal() as db:
        _reset(db)
        users = [
            User(name=n, email=e, password_hash=hash_password(p), role=r) for n, e, p, r in USERS
        ]
        db.add_all(users)
        for code, name, address, locs in WAREHOUSES:
            wh = Warehouse(code=code, name=name, address=address)
            wh.locations = [Location(name=n) for n in locs]
            db.add(wh)
        cats = {n: Category(name=n) for n in CATEGORIES}
        db.add_all(cats.values())
        db.add_all(
            Product(
                sku=s, name=n, category=cats[c], uom=u, min_qty=Decimal(mn), max_qty=Decimal(mx)
            )
            for s, n, c, u, mn, mx, _, _ in PRODUCTS
        )
        db.commit()

        manager, *staff = users
        loc = {l.full_name: l.id for l in db.scalars(select(Location))}  # noqa: E741
        prod = {p.sku: p for p in db.scalars(select(Product))}
        spec = {row[0]: row for row in PRODUCTS}
        today = datetime.now(IST).date()
        stamps: list[tuple[int, datetime, datetime | None]] = []  # (op id, created, validated)

        def at(day: date, hour: float) -> datetime:
            return datetime.combine(day, time(int(hour), int((hour % 1) * 60)), IST).astimezone(UTC)

        def balance(sku: str, location: str) -> Decimal:
            q = db.scalar(
                select(StockBalance.quantity).where(
                    StockBalance.product_id == prod[sku].id,
                    StockBalance.location_id == loc[location],
                )
            )
            return q or Decimal(0)

        def post(
            data: OperationCreate,
            when: datetime,
            *,
            by: User,
            validate: bool = True,
            confirm: bool = False,
            validator: User | None = None,
        ) -> bool:
            op = operation_service.build_operation(db, data, by)
            if validate:
                try:
                    operation_service.apply_stock(db, op, validator or by)
                except InsufficientStock:
                    db.rollback()
                    return False
            db.commit()
            if confirm:
                operation_service.confirm(db, op.id, by)
            created = when - timedelta(minutes=rnd.randint(20, 150))
            stamps.append((op.id, created if validate else when, when if validate else None))
            return True

        def line(sku: str, qty: Decimal, counted: bool = False) -> list[LineIn]:
            key = "counted_quantity" if counted else "quantity"
            return [LineIn(product_id=prod[sku].id, **{key: qty})]

        def stock_of(sku: str) -> list[tuple[str, Decimal]]:
            """(location, qty) for every location holding this product."""
            rows = db.execute(
                select(Location, StockBalance.quantity)
                .join(StockBalance, StockBalance.location_id == Location.id)
                .where(StockBalance.product_id == prod[sku].id, StockBalance.quantity > 0)
            )
            return [(lc.full_name, q) for lc, q in rows]

        def count(sku: str, location: str, shortfall: int, when: datetime) -> None:
            counted = max(Decimal(0), balance(sku, location) - shortfall)
            post(
                OperationCreate(
                    type="adjustment",
                    source_location_id=loc[location],
                    notes="Cycle count",
                    lines=line(sku, counted, counted=True),
                ),
                when,
                by=rnd.choice(staff),
                validator=manager,
            )

        # Day -14: opening counts (everything except the demo rod and the never-stocked motor)
        start = today - timedelta(days=DAYS)
        for i, (sku, _, _, uom, _mn, mx, home, role) in enumerate(PRODUCTS):
            if role in ("demo", "never"):
                continue
            qty = _q(mx * rnd.uniform(0.45, 0.7), uom)
            post(
                OperationCreate(
                    type="adjustment",
                    source_location_id=loc[home],
                    notes="Opening stock count",
                    lines=line(sku, qty, counted=True),
                ),
                at(start, 9 + i * 0.2),
                by=manager,
            )

        stocked = [s for s, *_rest in PRODUCTS if spec[s][7] not in ("demo", "never")]
        # Days -13 .. -1: daily operations
        for d in range(DAYS - 1, 0, -1):
            day = today - timedelta(days=d)
            # Scripted accuracy story: chairs miscounted twice, then moving every day, so
            # "Count next" ranks them high with all three reasons; bolts miscounted once.
            if d in (12, 10):
                count("CHR001", "WH/Stock", 2 if d == 12 else 1, at(day, 17.8))
            if d == 7:
                count("BLT001", "WH/Rack A", 3, at(day, 17.6))
            if d <= 9:
                for h in (11.2, 15.4):
                    if rnd.random() < 0.45 or balance("CHR001", "WH/Stock") < 4:
                        post(
                            OperationCreate(
                                type="receipt",
                                destination_location_id=loc["WH/Stock"],
                                partner_name="Godrej Interio",
                                lines=line("CHR001", Decimal(rnd.randint(3, 8))),
                            ),
                            at(day, h),
                            by=rnd.choice(users),
                        )
                    else:
                        post(
                            OperationCreate(
                                type="delivery",
                                source_location_id=loc["WH/Stock"],
                                partner_name=rnd.choice(CUSTOMERS),
                                lines=line("CHR001", Decimal(rnd.randint(1, 3))),
                            ),
                            at(day, h),
                            by=rnd.choice(users),
                        )
            hours = sorted(rnd.uniform(9, 18.5) for _ in range(rnd.randint(4, 7)))
            for h in hours:
                sku = rnd.choice(stocked)
                _, _, _, uom, mn, mx, home, role = spec[sku]
                who = rnd.choice(users)
                kind = rnd.choices(["receipt", "delivery", "transfer", "count"], [34, 40, 16, 10])[
                    0
                ]
                if role in ("low", "out") and kind == "receipt" and d < 5:
                    kind = "delivery"  # let these run down near the end
                if kind == "receipt":
                    post(
                        OperationCreate(
                            type="receipt",
                            destination_location_id=loc[home],
                            partner_name=rnd.choice(VENDORS),
                            lines=line(sku, _q(mx * rnd.uniform(0.15, 0.35), uom)),
                        ),
                        at(day, h),
                        by=who,
                    )
                elif kind == "delivery":
                    have = balance(sku, home)
                    if have > 0:
                        qty = min(have, _q(mx * rnd.uniform(0.05, 0.2), uom))
                        if qty > 0:
                            post(
                                OperationCreate(
                                    type="delivery",
                                    source_location_id=loc[home],
                                    partner_name=rnd.choice(CUSTOMERS),
                                    lines=line(sku, qty),
                                ),
                                at(day, h),
                                by=who,
                            )
                elif kind == "transfer":
                    src, dst = next(
                        ((s, t) for s, t in TRANSFER_ROUTES if s == home),
                        (
                            home,
                            "WH/Production Floor" if home != "WH/Production Floor" else "WH/Stock",
                        ),
                    )
                    qty = _q(float(balance(sku, src)) * rnd.uniform(0.1, 0.3), uom)
                    if qty > 0 and src != dst:
                        post(
                            OperationCreate(
                                type="transfer",
                                source_location_id=loc[src],
                                destination_location_id=loc[dst],
                                lines=line(sku, qty),
                            ),
                            at(day, h),
                            by=who,
                        )
                else:  # cycle count, usually finding a small shortfall
                    system = balance(sku, home)
                    if system > 0:
                        counted = max(
                            Decimal(0), system - _q(float(system) * rnd.uniform(0.0, 0.06), uom)
                        )
                        post(
                            OperationCreate(
                                type="adjustment",
                                source_location_id=loc[home],
                                notes="Cycle count",
                                lines=line(sku, counted, counted=True),
                            ),
                            at(day, h),
                            by=rnd.choice(staff),
                            validator=manager,
                        )

        # Day -1: push the "low" items under their reorder point and empty the "out" item
        yday = today - timedelta(days=1)
        for sku, *_x in PRODUCTS:
            _, _, _, uom, mn, mx, home, role = spec[sku]
            if role not in ("low", "out"):
                continue
            # Drain across ALL locations (transfers spread stock beyond the home shelf).
            target = Decimal(0) if role == "out" else _q(mn * 0.55, uom)
            excess = sum((q for _, q in stock_of(sku)), Decimal(0)) - target
            for location, q in sorted(stock_of(sku), key=lambda r: r[0] == home):  # home last
                if excess <= 0:
                    break
                take = min(q, excess)
                post(
                    OperationCreate(
                        type="delivery",
                        source_location_id=loc[location],
                        partner_name=rnd.choice(CUSTOMERS),
                        lines=line(sku, take),
                    ),
                    at(yday, 16.5),
                    by=rnd.choice(users),
                )
                excess -= take

        # Today: a few done this morning, plus open work for the board
        post(
            OperationCreate(
                type="receipt",
                destination_location_id=loc["WH/Rack A"],
                partner_name="SKF India",
                lines=line("BLT001", Decimal(40)),
            ),
            at(today, 9.4),
            by=staff[0],
        )
        post(
            OperationCreate(
                type="delivery",
                source_location_id=loc["WH/Stock"],
                partner_name="Kapoor Furnishings",
                lines=line("CHR001", Decimal(4)),
            ),
            at(today, 10.1),
            by=staff[1],
        )
        post(
            OperationCreate(
                type="transfer",
                source_location_id=loc["WH/Stock"],
                destination_location_id=loc["WH/Production Floor"],
                lines=line("CBL001", Decimal(120)),
            ),
            at(today, 10.6),
            by=staff[2],
        )
        open_ops = [
            (
                OperationCreate(
                    type="receipt",
                    destination_location_id=loc["WH/Rack B"],
                    partner_name="Hindalco Industries",
                    scheduled_date=today,
                    lines=line("ALU001", Decimal(90)),
                ),
                "confirm",
                manager,
            ),
            (
                OperationCreate(
                    type="receipt",
                    destination_location_id=loc["WH/Stock"],
                    partner_name="Supreme Industries",
                    scheduled_date=today + timedelta(days=1),
                    lines=line("PVC001", Decimal(250)),
                ),
                "confirm",
                staff[0],
            ),
            (
                OperationCreate(
                    type="receipt",
                    destination_location_id=loc["WH/Rack A"],
                    partner_name="SKF India",
                    scheduled_date=today + timedelta(days=2),
                    lines=line("BRG001", Decimal(400)),
                ),
                "draft",
                manager,
            ),
            (
                OperationCreate(
                    type="delivery",
                    source_location_id=loc["WH/Stock"],
                    partner_name="Sharma Engineering Works",
                    scheduled_date=today,
                    lines=line("MTR001", Decimal(4)),
                ),
                "confirm",
                staff[1],
            ),
            (
                OperationCreate(
                    type="delivery",
                    source_location_id=loc["LDH/Rack A"],
                    partner_name="Singh Auto Parts",
                    scheduled_date=today + timedelta(days=1),
                    lines=line("FLT001", Decimal(6)),
                ),
                "confirm",
                staff[2],
            ),
            (
                OperationCreate(
                    type="delivery",
                    source_location_id=loc["WH2/Stock"],
                    partner_name="Bharat Electricals",
                    scheduled_date=today + timedelta(days=1),
                    lines=line("LED001", Decimal(12)),
                ),
                "confirm",
                staff[0],
            ),
            (
                OperationCreate(
                    type="transfer",
                    source_location_id=loc["WH/Stock"],
                    destination_location_id=loc["WH2/Stock"],
                    scheduled_date=today,
                    lines=line("CHR001", Decimal(5)),
                ),
                "draft",
                staff[1],
            ),
            (
                OperationCreate(
                    type="adjustment",
                    source_location_id=loc["WH/Rack A"],
                    notes="Cycle count (awaiting manager)",
                    lines=line("SWT001", Decimal(14), counted=True),
                ),
                "draft",
                staff[2],
            ),
        ]
        for i, (data, mode, who) in enumerate(open_ops):
            post(data, at(today, 11 + i * 0.3), by=who, validate=False, confirm=(mode == "confirm"))

        # Re-date the history (timestamps only; see module docstring).
        db.execute(text("ALTER TABLE stock_ledger DISABLE TRIGGER stock_ledger_append_only"))
        for op_id, created, validated in stamps:
            db.execute(
                text(
                    "UPDATE operations SET created_at = :c, updated_at = COALESCE(:v, :c), "
                    "validated_at = COALESCE(:v, validated_at) WHERE id = :id"
                ),
                {"c": created, "v": validated, "id": op_id},
            )
            if validated:
                db.execute(
                    text("UPDATE stock_ledger SET created_at = :v WHERE operation_id = :id"),
                    {"v": validated, "id": op_id},
                )
        db.execute(text("ALTER TABLE stock_ledger ENABLE TRIGGER stock_ledger_append_only"))
        db.commit()
        done = sum(1 for *_x, v in stamps if v)
        print(
            f"Demo data: {len(users)} users, {len(WAREHOUSES)} warehouses, {len(loc)} locations, "
            f"{len(PRODUCTS)} products, {done} validated operations over {DAYS} days, "
            f"{len(stamps) - done} open operations."
        )
        print(
            "Logins: manager@stocksense.dev / Manager@123 · staff@stocksense.dev / Staff@123 "
            "(also priya@ / imran@ with Staff@123)"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wipe the database and load rich demo data.")
    parser.add_argument("--yes", action="store_true", help="confirm: this deletes ALL data")
    if not parser.parse_args().yes:
        raise SystemExit("Refusing to run without --yes (this deletes ALL data).")
    seed_demo()
