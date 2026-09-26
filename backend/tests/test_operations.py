"""Acceptance matrix from docs/DEMO.md (T-01..T-16) plus lifecycle rules."""

from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.errors import InsufficientStock
from app.models import User
from app.services import operation_service
from tests.helpers import create, qty, run, setup_world, total


@pytest.fixture
def w(manager):
    return setup_world(manager)


def _receive(c, w, product, amount, loc="Stock"):
    r = run(c, "receipt", [{"product_id": w[product], "quantity": amount}], dst=w["loc"][loc])
    assert r.status_code == 200, r.json()


def test_t01_receipt_increases_stock_once(manager, w):
    r = run(
        manager, "receipt", [{"product_id": w["steel"], "quantity": "50"}], dst=w["loc"]["Stock"]
    )
    assert r.status_code == 200
    ledger = manager.get("/api/ledger").json()
    assert ledger["total"] == 1 and ledger["items"][0]["quantity_delta"] == "50.000"


def test_t02_t03_delivery_and_rejection(manager, w):
    _receive(manager, w, "steel", 50)
    assert (
        run(
            manager, "delivery", [{"product_id": w["steel"], "quantity": 10}], src=w["loc"]["Stock"]
        ).status_code
        == 200
    )
    r = run(
        manager, "delivery", [{"product_id": w["steel"], "quantity": 100}], src=w["loc"]["Stock"]
    )
    assert r.status_code == 409
    assert qty(manager, w["steel"], w["loc"]["Stock"]) == "40.000"
    # the rejected delivery stays open, not done
    op = manager.get("/api/operations", params={"type": "delivery", "status": "draft"}).json()
    assert op["total"] == 1


def test_t04_transfer_conserves_total_and_writes_two_rows(manager, w):
    _receive(manager, w, "steel", 40)
    r = run(
        manager,
        "transfer",
        [{"product_id": w["steel"], "quantity": 15}],
        src=w["loc"]["Stock"],
        dst=w["loc"]["Rack A"],
    )
    assert len(r.json()["stock_effects"]) == 2
    assert qty(manager, w["steel"], w["loc"]["Stock"]) == "25.000"
    assert qty(manager, w["steel"], w["loc"]["Rack A"]) == "15.000"
    assert total(manager, w["steel"]) == "40.000"


def test_t05_same_location_transfer_rejected(manager, w):
    s = w["loc"]["Stock"]
    r = create(manager, "transfer", [{"product_id": w["steel"], "quantity": 1}], src=s, dst=s)
    assert r.status_code == 422 and r.json()["code"] == "SAME_LOCATION"


def test_t06_adjustment_sets_counted_quantity(manager, w):
    _receive(manager, w, "steel", 15, "Rack A")
    r = run(
        manager,
        "adjustment",
        [{"product_id": w["steel"], "counted_quantity": 12}],
        src=w["loc"]["Rack A"],
    )
    assert r.json()["lines"][0]["system_quantity"] == "15.000"
    assert qty(manager, w["steel"], w["loc"]["Rack A"]) == "12.000"


def test_adjustment_matching_count_writes_no_ledger_row(manager, w):
    _receive(manager, w, "steel", 10)
    r = run(
        manager,
        "adjustment",
        [{"product_id": w["steel"], "counted_quantity": 10}],
        src=w["loc"]["Stock"],
    )
    assert r.status_code == 200 and r.json()["stock_effects"] == []


def test_t07_validate_twice_moves_stock_once(manager, w):
    op = create(
        manager, "receipt", [{"product_id": w["steel"], "quantity": 5}], dst=w["loc"]["Stock"]
    ).json()
    first = manager.post(f"/api/operations/{op['id']}/validate").json()
    second = manager.post(f"/api/operations/{op['id']}/validate").json()
    assert first["already_done"] is False and second["already_done"] is True
    assert second["stock_effects"] == []
    assert total(manager, w["steel"]) == "5.000"
    assert manager.get("/api/ledger").json()["total"] == 1


def test_t08_multi_line_transfer_is_atomic(manager, w):
    _receive(manager, w, "steel", 10)
    _receive(manager, w, "chair", 1)
    r = run(
        manager,
        "transfer",
        [{"product_id": w["steel"], "quantity": 5}, {"product_id": w["chair"], "quantity": 3}],
        src=w["loc"]["Stock"],
        dst=w["loc"]["Rack A"],
    )
    assert r.status_code == 409
    assert [ln["sku"] for ln in r.json()["details"]["lines"]] == ["CHR001"]
    # neither line moved
    assert qty(manager, w["steel"], w["loc"]["Stock"]) == "10.000"
    assert qty(manager, w["steel"], w["loc"]["Rack A"]) == "0.000"


def test_t09_concurrent_deliveries_never_oversell(manager, w):
    _receive(manager, w, "steel", 10)
    ids = [
        create(
            manager, "delivery", [{"product_id": w["steel"], "quantity": 10}], src=w["loc"]["Stock"]
        ).json()["id"]
        for _ in range(2)
    ]

    def attempt(op_id):
        with SessionLocal() as db:
            try:
                operation_service.validate(db, op_id, db.get(User, manager.user_id))
                return "ok"
            except InsufficientStock:
                return "short"

    with ThreadPoolExecutor(2) as pool:
        results = sorted(pool.map(attempt, ids))
    assert results == ["ok", "short"]
    assert qty(manager, w["steel"], w["loc"]["Stock"]) == "0.000"
    assert manager.get("/api/inventory/integrity").json()["ok"] is True


def test_t12_staff_cannot_validate_adjustment(manager, staff, w):
    op = create(
        staff,
        "adjustment",
        [{"product_id": w["steel"], "counted_quantity": 3}],
        src=w["loc"]["Stock"],
    )
    assert op.status_code == 201  # staff may prepare a count...
    r = staff.post(f"/api/operations/{op.json()['id']}/validate")
    assert r.status_code == 403  # ...but only a manager may apply it
    # staff can run routine movements
    assert (
        run(
            staff, "receipt", [{"product_id": w["steel"], "quantity": 1}], dst=w["loc"]["Stock"]
        ).status_code
        == 200
    )


def test_t16_done_operation_is_immutable(manager, w):
    _receive(manager, w, "steel", 5)
    op_id = manager.get("/api/operations").json()["items"][0]["id"]
    assert manager.patch(f"/api/operations/{op_id}", json={"notes": "x"}).status_code == 409
    r = manager.post(f"/api/operations/{op_id}/cancel")
    assert r.status_code == 409 and r.json()["code"] == "INVALID_STATE"


def test_confirm_sets_ready_or_waiting(manager, w):
    op = create(
        manager, "delivery", [{"product_id": w["steel"], "quantity": 5}], src=w["loc"]["Stock"]
    ).json()
    assert manager.post(f"/api/operations/{op['id']}/confirm").json()["status"] == "waiting"
    _receive(manager, w, "steel", 5)
    assert manager.post(f"/api/operations/{op['id']}/confirm").json()["status"] == "ready"
    assert manager.post(f"/api/operations/{op['id']}/validate").json()["status"] == "done"


def test_cancel_then_validate_rejected(manager, w):
    op = create(
        manager, "receipt", [{"product_id": w["steel"], "quantity": 5}], dst=w["loc"]["Stock"]
    ).json()
    assert manager.post(f"/api/operations/{op['id']}/cancel").json()["status"] == "canceled"
    assert manager.post(f"/api/operations/{op['id']}/validate").status_code == 409


def test_edit_draft_replaces_lines(manager, w):
    op = create(
        manager, "receipt", [{"product_id": w["steel"], "quantity": 5}], dst=w["loc"]["Stock"]
    ).json()
    r = manager.patch(
        f"/api/operations/{op['id']}",
        json={
            "partner_name": "Tata Steel",
            "lines": [
                {"product_id": w["steel"], "quantity": 7},
                {"product_id": w["chair"], "quantity": 2},
            ],
        },
    )
    assert r.status_code == 200, r.json()
    body = r.json()
    assert body["partner_name"] == "Tata Steel"
    assert [(ln["sku"], ln["quantity"]) for ln in body["lines"]] == [
        ("STL001", "7.000"),
        ("CHR001", "2.000"),
    ]


@pytest.mark.parametrize(
    ("type_", "lines", "src", "dst", "fields"),
    [
        ("receipt", [{"product_id": 1, "quantity": 1}], None, None, {"destination_location_id"}),
        ("delivery", [{"product_id": 1, "quantity": 1}], None, None, {"source_location_id"}),
        ("receipt", [{"product_id": 1, "quantity": 0}], None, "Stock", {"lines.0.quantity"}),
        (
            "adjustment",
            [{"product_id": 1, "quantity": 2}],
            "Stock",
            None,
            {"lines.0.counted_quantity"},
        ),
        ("receipt", [{"product_id": 999, "quantity": 1}], None, "Stock", {"lines.0.product_id"}),
        (
            "receipt",
            [{"product_id": 1, "quantity": 1}, {"product_id": 1, "quantity": 2}],
            None,
            "Stock",
            {"lines.1.product_id"},
        ),
    ],
)
def test_invalid_operations_report_fields(manager, w, type_, lines, src, dst, fields):
    loc = w["loc"]
    r = create(manager, type_, lines, loc.get(src), loc.get(dst))
    assert r.status_code == 422, r.json()
    assert {e["field"] for e in r.json()["field_errors"]} == fields


def test_empty_lines_rejected(manager, w):
    r = create(manager, "receipt", [], dst=w["loc"]["Stock"])
    assert r.status_code == 422 and r.json()["field_errors"][0]["field"] == "lines"


def test_references_are_sequential_per_warehouse_and_type(manager, w):
    refs = [
        create(
            manager, "receipt", [{"product_id": w["steel"], "quantity": 1}], dst=w["loc"]["Stock"]
        ).json()["reference"]
        for _ in range(3)
    ]
    assert refs == ["WH/IN/0001", "WH/IN/0002", "WH/IN/0003"]


def test_operation_filters(manager, w):
    _receive(manager, w, "steel", 5)
    create(
        manager,
        "delivery",
        [{"product_id": w["chair"], "quantity": 1}],
        src=w["loc"]["Stock"],
        partner_name="Acme Retail",
    )
    get = lambda **p: manager.get("/api/operations", params=p).json()["total"]  # noqa: E731
    assert get() == 2
    assert get(type="delivery") == 1
    assert get(status="draft,waiting,ready") == 1
    assert get(search="acme") == 1
    assert get(location_id=w["loc"]["Rack A"]) == 0
    r = manager.get("/api/operations", params={"status": "bogus"})
    assert r.status_code == 422 and r.json()["field_errors"][0]["field"] == "status"


def test_product_initial_stock_is_ledgered(manager, w):
    r = manager.post(
        "/api/products",
        json={
            "sku": "BRG001",
            "name": "Bearing",
            "uom": "unit",
            "initial_quantity": "30",
            "initial_location_id": w["loc"]["Rack A"],
        },
    )
    assert r.status_code == 201, r.json()
    assert r.json()["on_hand"] == "30.000"
    entry = manager.get("/api/ledger", params={"product_id": r.json()["id"]}).json()["items"][0]
    assert entry["movement_type"] == "adjustment" and entry["quantity_delta"] == "30.000"

    r = manager.post(
        "/api/products", json={"sku": "X1", "name": "X", "uom": "unit", "initial_quantity": "5"}
    )
    assert r.status_code == 422
    assert r.json()["field_errors"][0]["field"] == "initial_location_id"


def test_decimal_quantities(manager, w):
    _receive(manager, w, "steel", Decimal("0.125").__str__())
    r = run(
        manager, "delivery", [{"product_id": w["steel"], "quantity": "0.1"}], src=w["loc"]["Stock"]
    )
    assert r.status_code == 200
    assert qty(manager, w["steel"], w["loc"]["Stock"]) == "0.025"
