"""The demo story from docs/DEMO.md, end to end through the HTTP API."""

from tests.helpers import qty, run, setup_world, total


def test_steel_rod_lifecycle(manager):
    w = setup_world(manager)
    steel, stock, prod = w["steel"], w["loc"]["Stock"], w["loc"]["Production Floor"]

    # 1. Receive 100 kg from the vendor into WH/Stock
    r = run(manager, "receipt", [{"product_id": steel, "quantity": 100}], dst=stock)
    assert r.status_code == 200, r.json()
    body = r.json()
    assert body["reference"] == "WH/IN/0001" and body["status"] == "done"
    assert body["stock_effects"][0]["quantity_delta"] == "100.000"
    assert total(manager, steel) == "100.000"

    # 2. Move 40 kg to the production floor: total unchanged
    r = run(manager, "transfer", [{"product_id": steel, "quantity": 40}], src=stock, dst=prod)
    assert r.json()["reference"] == "WH/INT/0001"
    assert (qty(manager, steel, stock), qty(manager, steel, prod)) == ("60.000", "40.000")
    assert total(manager, steel) == "100.000"

    # 3. Try to deliver 50 from the floor: rejected, nothing changes
    r = run(manager, "delivery", [{"product_id": steel, "quantity": 50}], src=prod)
    assert r.status_code == 409 and r.json()["code"] == "INSUFFICIENT_STOCK"
    assert r.json()["details"]["lines"][0]["available"] == "40.000"
    assert qty(manager, steel, prod) == "40.000"

    # 4. Deliver 20
    r = run(manager, "delivery", [{"product_id": steel, "quantity": 20}], src=prod)
    assert (
        r.status_code == 200 and r.json()["reference"] == "WH/OUT/0002"
    )  # 0001 was the rejected draft
    assert total(manager, steel) == "80.000"

    # 5. Physical count finds 17 kg on the floor: adjustment -3
    r = run(manager, "adjustment", [{"product_id": steel, "counted_quantity": 17}], src=prod)
    assert r.status_code == 200
    assert r.json()["lines"][0]["system_quantity"] == "20.000"
    assert r.json()["stock_effects"][0]["quantity_delta"] == "-3.000"
    assert total(manager, steel) == "77.000"

    # 6. Move history explains every change (newest first)
    ledger = manager.get("/api/ledger", params={"product_id": steel}).json()["items"]
    assert [(e["movement_type"], e["location_name"], e["quantity_delta"]) for e in ledger] == [
        ("adjustment", "WH/Production Floor", "-3.000"),
        ("delivery", "WH/Production Floor", "-20.000"),
        ("transfer", "WH/Production Floor", "40.000"),
        ("transfer", "WH/Stock", "-40.000"),
        ("receipt", "WH/Stock", "100.000"),
    ]
    assert ledger[0]["balance_after"] == "17.000"
    assert ledger[2]["counterpart_location_name"] == "WH/Stock"

    # 7. Ledger reconciles with balances
    assert manager.get("/api/inventory/integrity").json()["ok"] is True
