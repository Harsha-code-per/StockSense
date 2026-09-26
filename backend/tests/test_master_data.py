"""Categories, products, warehouses, locations: validation, roles, uniqueness."""

from decimal import Decimal

from app.models import StockBalance
from app.services.inventory_service import stock_status, suggested_order


def _fields(r):
    return {e["field"] for e in r.json()["field_errors"]}


def test_requires_login(client):
    r = client.get("/api/products")
    assert r.status_code == 401
    assert r.json()["code"] == "UNAUTHORIZED"


def test_staff_can_read_but_not_write_master_data(staff):
    assert staff.get("/api/products").status_code == 200
    r = staff.post("/api/products", json={"sku": "X1", "name": "X", "uom": "unit"})
    assert r.status_code == 403
    assert r.json()["code"] == "FORBIDDEN"


def test_category_names_are_unique_case_insensitive(manager):
    assert manager.post("/api/categories", json={"name": "Raw Material"}).status_code == 201
    r = manager.post("/api/categories", json={"name": "  raw material "})
    assert r.status_code == 409
    assert r.json()["code"] == "DUPLICATE"
    assert _fields(r) == {"name"}


def test_create_product_normalizes_and_rejects_duplicate_sku(manager):
    body = {"sku": "stl001", "name": "Steel Rod", "uom": "kg", "min_qty": "20", "max_qty": 200}
    r = manager.post("/api/products", json=body)
    assert r.status_code == 201, r.json()
    p = r.json()
    assert p["sku"] == "STL001"
    assert p["min_qty"] == "20.000" and p["on_hand"] == "0.000"
    assert p["stock_status"] == "out" and p["suggested_order"] == "200.000"

    r = manager.post("/api/products", json=body)
    assert r.status_code == 409
    assert r.json()["details"]["field"] == "sku"


def test_product_validation_reports_each_field(manager):
    r = manager.post(
        "/api/products",
        json={
            "sku": "bad sku!",
            "name": "",
            "uom": "crate",
            "min_qty": "10",
            "max_qty": "5",
            "category_id": 999,
        },
    )
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"
    assert {"sku", "name", "uom", "max_qty"} <= _fields(r)


def test_product_quantity_precision_capped_at_3_decimals(manager):
    r = manager.post(
        "/api/products", json={"sku": "A1", "name": "A", "uom": "kg", "min_qty": "1.2345"}
    )
    assert r.status_code == 422
    assert _fields(r) == {"min_qty"}


def test_unknown_category_is_a_field_error(manager):
    r = manager.post(
        "/api/products", json={"sku": "A1", "name": "A", "uom": "kg", "category_id": 999}
    )
    assert r.status_code == 422
    assert _fields(r) == {"category_id"}


def test_update_product_and_filters(manager):
    cat = manager.post("/api/categories", json={"name": "Furniture"}).json()
    pid = manager.post(
        "/api/products",
        json={"sku": "CHR001", "name": "Office Chair", "uom": "unit", "category_id": cat["id"]},
    ).json()["id"]
    manager.post("/api/products", json={"sku": "BRG001", "name": "Bearing", "uom": "unit"})

    r = manager.patch(f"/api/products/{pid}", json={"min_qty": "5", "max_qty": "50"})
    assert r.status_code == 200 and r.json()["max_qty"] == "50.000"
    r = manager.patch(f"/api/products/{pid}", json={"max_qty": "1"})
    assert r.status_code == 422 and _fields(r) == {"max_qty"}

    page = manager.get("/api/products", params={"search": "chair"}).json()
    assert page["total"] == 1 and page["items"][0]["sku"] == "CHR001"
    assert manager.get("/api/products", params={"category_id": cat["id"]}).json()["total"] == 1
    assert manager.get("/api/products", params={"stock_status": "out"}).json()["total"] == 2
    assert (
        manager.get("/api/products", params={"page_size": 1}).json()["items"][0]["name"]
        == "Bearing"
    )

    detail = manager.get(f"/api/products/{pid}").json()
    assert detail["stock_by_location"] == [] and detail["recent_moves"] == []
    assert manager.get("/api/products/9999").status_code == 404


def test_warehouse_gets_default_location_and_unique_code(manager):
    r = manager.post("/api/warehouses", json={"code": "wh", "name": "Main Warehouse"})
    assert r.status_code == 201
    wh = r.json()
    assert wh["code"] == "WH" and wh["location_count"] == 1
    locs = manager.get("/api/locations", params={"warehouse_id": wh["id"]}).json()
    assert [loc["full_name"] for loc in locs] == ["WH/Stock"]

    assert manager.post("/api/warehouses", json={"code": "WH", "name": "Dup"}).status_code == 409
    r = manager.post("/api/warehouses", json={"code": "W", "name": "Too short"})
    assert r.status_code == 422 and _fields(r) == {"code"}


def test_location_names_unique_per_warehouse(manager):
    wh1 = manager.post("/api/warehouses", json={"code": "WH", "name": "Main"}).json()
    wh2 = manager.post("/api/warehouses", json={"code": "WH2", "name": "Second"}).json()
    r = manager.post("/api/locations", json={"warehouse_id": wh1["id"], "name": "Rack A"})
    assert r.status_code == 201 and r.json()["full_name"] == "WH/Rack A"
    r = manager.post("/api/locations", json={"warehouse_id": wh1["id"], "name": "Rack A"})
    assert r.status_code == 409 and _fields(r) == {"name"}
    r = manager.post("/api/locations", json={"warehouse_id": wh2["id"], "name": "Rack A"})
    assert r.status_code == 201
    r = manager.post("/api/locations", json={"warehouse_id": 999, "name": "X"})
    assert r.status_code == 422 and _fields(r) == {"warehouse_id"}


def test_cannot_deactivate_location_or_warehouse_holding_stock(manager, db):
    wh = manager.post("/api/warehouses", json={"code": "WH", "name": "Main"}).json()
    loc_id = manager.get("/api/locations").json()[0]["id"]
    pid = manager.post("/api/products", json={"sku": "S1", "name": "S", "uom": "kg"}).json()["id"]
    # Test setup only: real stock changes always go through operations.
    db.add(StockBalance(product_id=pid, location_id=loc_id, quantity=Decimal("5")))
    db.commit()

    r = manager.patch(f"/api/locations/{loc_id}", json={"is_active": False})
    assert r.status_code == 409 and r.json()["code"] == "INVALID_STATE"
    r = manager.patch(f"/api/warehouses/{wh['id']}", json={"is_active": False})
    assert r.status_code == 409


def test_inventory_endpoints_on_empty_db(manager):
    assert manager.get("/api/inventory").json()["total"] == 0
    r = manager.get("/api/inventory/available", params={"product_id": 1, "location_id": 1})
    assert r.json()["quantity"] == "0.000"
    assert manager.get("/api/inventory/integrity").json() == {
        "ok": True,
        "checked": 0,
        "mismatches": [],
    }


def test_low_stock_math():
    d = Decimal
    assert stock_status(d(0), d(20)) == "out"
    assert stock_status(d(5), d(20)) == "low"
    assert stock_status(d(20), d(20)) == "in_stock"
    assert stock_status(d(5), d(0)) == "in_stock"
    assert suggested_order(d(5), d(20), d(200)) == d(195)
    assert suggested_order(d(50), d(20), d(200)) == 0


def test_seed_is_idempotent(capsys):
    from app.seed import seed

    seed()
    seed()
    assert "skipping" in capsys.readouterr().out
