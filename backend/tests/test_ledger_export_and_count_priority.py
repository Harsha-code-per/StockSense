import csv
import io

from app.services.count_priority_service import level, reasons, score
from tests.helpers import run, setup_world


def test_ledger_csv_export_with_filters(manager):
    w = setup_world(manager)
    run(manager, "receipt", [{"product_id": w["steel"], "quantity": 100}], dst=w["loc"]["Stock"])
    run(manager, "delivery", [{"product_id": w["steel"], "quantity": 20}], src=w["loc"]["Stock"])

    r = manager.get("/api/ledger/export.csv")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(r.text)))
    assert rows[0][:4] == ["timestamp_utc", "reference", "movement_type", "sku"]
    assert [(row[2], row[8], row[9]) for row in rows[1:]] == [
        ("delivery", "-20.000", "80.000"),
        ("receipt", "100.000", "100.000"),
    ]
    only_receipts = manager.get("/api/ledger/export.csv", params={"movement_type": "receipt"})
    assert len(list(csv.reader(io.StringIO(only_receipts.text)))) == 2


def test_csv_export_neutralizes_formula_injection(manager):
    w = setup_world(manager)
    evil = manager.post(
        "/api/products", json={"sku": "EVIL1", "name": '=HYPERLINK("x")', "uom": "unit"}
    ).json()
    run(manager, "receipt", [{"product_id": evil["id"], "quantity": 1}], dst=w["loc"]["Stock"])
    row = list(csv.reader(io.StringIO(manager.get("/api/ledger/export.csv").text)))[1]
    assert row[4] == '\'=HYPERLINK("x")'


def test_exports_require_login(client):
    assert client.get("/api/ledger/export.csv").status_code == 401
    assert client.get("/api/inventory/count-priority").status_code == 401


def test_count_priority_ranks_and_explains(manager):
    w = setup_world(manager)
    stock = w["loc"]["Stock"]
    # Steel: busy and never verified.
    run(manager, "receipt", [{"product_id": w["steel"], "quantity": 100}], dst=stock)
    for _ in range(6):
        run(manager, "delivery", [{"product_id": w["steel"], "quantity": 1}], src=stock)
    # Chair: opening stock (not a discrepancy), then a real recount that disagreed.
    manager.post(
        "/api/products",
        json={
            "sku": "LMP001",
            "name": "Lamp",
            "uom": "unit",
            "initial_quantity": 5,
            "initial_location_id": stock,
        },
    )
    run(manager, "receipt", [{"product_id": w["chair"], "quantity": 5}], dst=stock)
    run(manager, "adjustment", [{"product_id": w["chair"], "counted_quantity": 4}], src=stock)

    items = manager.get("/api/inventory/count-priority").json()
    by_sku = {i["sku"]: i for i in items}
    assert items[0]["sku"] == "STL001"
    steel = by_sku["STL001"]
    assert steel["movements_since_count"] == 7 and steel["last_counted_at"] is None
    assert steel["score"] == 14 and steel["level"] == "low"
    assert any("Never counted" in r for r in steel["reasons"])
    assert "7 movements since last count" in steel["reasons"]

    chair = by_sku["CHR001"]
    assert chair["past_discrepancies"] == 1 and chair["movements_since_count"] == 0
    assert chair["reasons"] == ["1 past count discrepancy"]
    lamp = by_sku["LMP001"]  # initial stock = first count, not a mismatch
    assert lamp["past_discrepancies"] == 0 and lamp["score"] == 0

    assert len(manager.get("/api/inventory/count-priority", params={"limit": 1}).json()) == 1


def test_score_formula_is_capped_and_explained():
    assert score(0, 0, 0) == 0
    assert score(20, 30, 3) == 100
    assert score(1000, 1000, 1000) == 100  # capped: one extreme factor can't exceed its weight
    assert score(20, 0, 0) == 40
    assert level(60) == "high" and level(30) == "medium" and level(29) == "low"
    assert reasons(0, 45, False, 0) == ["45 days since last count"]
    assert reasons(1, 1, True, 2) == [
        "Never counted (first movement 1 day ago)",
        "1 movement since last count",
        "2 past count discrepancies",
    ]
