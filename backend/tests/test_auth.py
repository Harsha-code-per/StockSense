"""Authentication tests: signup, login, lockout, session cookies, profile, and OTP reset."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models.user import PasswordReset, User
from app.security import SESSION_COOKIE


def test_signup_success(client):
    r = client.post(
        "/api/auth/signup",
        json={"name": "Alice Staff", "email": "alice@test.dev", "password": "Password123"},
    )
    assert r.status_code == 201, r.json()
    data = r.json()
    assert data["name"] == "Alice Staff"
    assert data["email"] == "alice@test.dev"
    assert data["role"] == "staff"
    assert isinstance(data["id"], int)
    assert "created_at" in data

    # Verify session cookie was set
    assert SESSION_COOKIE in client.cookies

    # Calling /me should return current user
    me_res = client.get("/api/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["id"] == data["id"]


def test_signup_duplicate_rejected(client):
    r1 = client.post(
        "/api/auth/signup",
        json={"name": "Alice One", "email": "unique@test.dev", "password": "Password123"},
    )
    assert r1.status_code == 201

    # Second signup with same email (case-insensitive)
    r2 = client.post(
        "/api/auth/signup",
        json={"name": "Alice Two", "email": "UNIQUE@test.dev", "password": "Password123"},
    )
    assert r2.status_code == 409
    body = r2.json()
    assert body["code"] == "DUPLICATE"
    assert body["details"]["field"] == "email"


def test_signup_validation_rules(client):
    # Short password
    r = client.post(
        "/api/auth/signup",
        json={"name": "Alice", "email": "valid@test.dev", "password": "short"},
    )
    assert r.status_code == 422
    assert any(fe["field"] == "password" for fe in r.json()["field_errors"])

    # Password without digits
    r = client.post(
        "/api/auth/signup",
        json={"name": "Alice", "email": "valid@test.dev", "password": "NoDigitsPassword"},
    )
    assert r.status_code == 422

    # Password > 72 chars (bcrypt limitation)
    r = client.post(
        "/api/auth/signup",
        json={"name": "Alice", "email": "valid@test.dev", "password": "A" * 73 + "1"},
    )
    assert r.status_code == 422

    # Invalid email format
    r = client.post(
        "/api/auth/signup",
        json={"name": "Alice", "email": "not-an-email", "password": "Password123"},
    )
    assert r.status_code == 422

    # Short name (< 2 chars)
    r = client.post(
        "/api/auth/signup",
        json={"name": "A", "email": "valid@test.dev", "password": "Password123"},
    )
    assert r.status_code == 422


def test_login_success_and_logout(client):
    # Create user
    client.post(
        "/api/auth/signup",
        json={"name": "Bob Staff", "email": "bob@test.dev", "password": "Password123"},
    )
    client.cookies.clear()

    # Login
    r = client.post(
        "/api/auth/login",
        json={"email": "bob@test.dev", "password": "Password123"},
    )
    assert r.status_code == 200
    assert r.json()["email"] == "bob@test.dev"
    assert SESSION_COOKIE in client.cookies

    # Verify authenticated
    assert client.get("/api/auth/me").status_code == 200

    # Logout
    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 204

    # Now /me should be unauthorized
    assert client.get("/api/auth/me").status_code == 401


def test_login_invalid_credentials(client):
    # Non-existent user
    r = client.post(
        "/api/auth/login",
        json={"email": "nobody@test.dev", "password": "Password123"},
    )
    assert r.status_code == 401
    assert r.json()["code"] == "UNAUTHORIZED"

    # Existing user, wrong password
    client.post(
        "/api/auth/signup",
        json={"name": "Charlie", "email": "charlie@test.dev", "password": "Password123"},
    )
    client.cookies.clear()

    wrong_res = client.post(
        "/api/auth/login",
        json={"email": "charlie@test.dev", "password": "WrongPassword999"},
    )
    assert wrong_res.status_code == 401
    assert wrong_res.json()["code"] == "UNAUTHORIZED"


def test_login_lockout_after_5_failed_attempts(client):
    client.post(
        "/api/auth/signup",
        json={"name": "Lockout User", "email": "lockout@test.dev", "password": "CorrectPass123"},
    )
    client.cookies.clear()

    # 5 failed attempts
    for _ in range(5):
        r = client.post(
            "/api/auth/login",
            json={"email": "lockout@test.dev", "password": "WrongPassword123"},
        )
        assert r.status_code == 401

    # 6th attempt should be blocked by rate limit / lockout
    r6 = client.post(
        "/api/auth/login",
        json={"email": "lockout@test.dev", "password": "WrongPassword123"},
    )
    assert r6.status_code == 429
    assert r6.json()["code"] == "TOO_MANY_ATTEMPTS"

    # Even with correct password, user is locked
    r_correct = client.post(
        "/api/auth/login",
        json={"email": "lockout@test.dev", "password": "CorrectPass123"},
    )
    assert r_correct.status_code == 429
    assert r_correct.json()["code"] == "TOO_MANY_ATTEMPTS"


def test_get_and_patch_profile(client):
    client.post(
        "/api/auth/signup",
        json={"name": "David", "email": "david@test.dev", "password": "Password123"},
    )

    # Get profile
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["name"] == "David"

    # Patch profile name
    patch_res = client.patch("/api/auth/me", json={"name": "David Senior"})
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "David Senior"

    # Confirm updated in /me
    assert client.get("/api/auth/me").json()["name"] == "David Senior"


def test_forgot_password_enumeration_safe(client, monkeypatch):
    captured = []
    monkeypatch.setattr(
        "app.services.auth_service.send_otp_email", lambda email, otp: captured.append((email, otp))
    )

    # Non-existent email
    r1 = client.post("/api/auth/forgot-password", json={"email": "ghost@test.dev"})
    assert r1.status_code == 200
    assert r1.json()["message"] == "If the account exists, a code was sent."
    assert len(captured) == 0

    # Real email
    client.post(
        "/api/auth/signup",
        json={"name": "Eve", "email": "eve@test.dev", "password": "Password123"},
    )
    client.cookies.clear()

    r2 = client.post("/api/auth/forgot-password", json={"email": "eve@test.dev"})
    assert r2.status_code == 200
    assert r2.json()["message"] == "If the account exists, a code was sent."
    assert len(captured) == 1
    assert captured[0][0] == "eve@test.dev"
    assert len(captured[0][1]) == 6


def test_otp_verification_and_password_reset_flow(client, monkeypatch):
    captured = []
    monkeypatch.setattr(
        "app.services.auth_service.send_otp_email", lambda email, otp: captured.append((email, otp))
    )

    client.post(
        "/api/auth/signup",
        json={"name": "Frank", "email": "frank@test.dev", "password": "OldPassword123"},
    )
    client.cookies.clear()

    # Request reset
    client.post("/api/auth/forgot-password", json={"email": "frank@test.dev"})
    otp = captured[-1][1]

    # Verify OTP without consuming
    v_res = client.post("/api/auth/verify-otp", json={"email": "frank@test.dev", "otp": otp})
    assert v_res.status_code == 200
    assert v_res.json()["valid"] is True

    # Reset password
    reset_res = client.post(
        "/api/auth/reset-password",
        json={"email": "frank@test.dev", "otp": otp, "new_password": "BrandNewPassword123"},
    )
    assert reset_res.status_code == 200
    assert reset_res.json()["message"] == "Password updated."

    # Login with old password must fail
    assert (
        client.post(
            "/api/auth/login", json={"email": "frank@test.dev", "password": "OldPassword123"}
        ).status_code
        == 401
    )

    # Login with new password succeeds
    login_res = client.post(
        "/api/auth/login", json={"email": "frank@test.dev", "password": "BrandNewPassword123"}
    )
    assert login_res.status_code == 200
    assert login_res.json()["email"] == "frank@test.dev"


def test_otp_invalid_and_rate_limiting(client, monkeypatch):
    captured = []
    monkeypatch.setattr(
        "app.services.auth_service.send_otp_email", lambda email, otp: captured.append((email, otp))
    )

    client.post(
        "/api/auth/signup",
        json={"name": "Grace", "email": "grace@test.dev", "password": "Password123"},
    )
    client.cookies.clear()

    client.post("/api/auth/forgot-password", json={"email": "grace@test.dev"})

    # 4 invalid attempts
    for _ in range(4):
        r = client.post("/api/auth/verify-otp", json={"email": "grace@test.dev", "otp": "000000"})
        assert r.status_code == 400
        assert r.json()["code"] == "OTP_INVALID"

    # 5th attempt locks OTP
    r5 = client.post("/api/auth/verify-otp", json={"email": "grace@test.dev", "otp": "000000"})
    assert r5.status_code == 429
    assert r5.json()["code"] == "TOO_MANY_ATTEMPTS"


def test_otp_expired(client, db, monkeypatch):
    captured = []
    monkeypatch.setattr(
        "app.services.auth_service.send_otp_email", lambda email, otp: captured.append((email, otp))
    )

    client.post(
        "/api/auth/signup",
        json={"name": "Heidi", "email": "heidi@test.dev", "password": "Password123"},
    )
    client.cookies.clear()

    client.post("/api/auth/forgot-password", json={"email": "heidi@test.dev"})
    otp = captured[-1][1]

    # Expire OTP in DB
    user = db.scalar(select(User).where(User.email == "heidi@test.dev"))
    pr = db.scalar(select(PasswordReset).where(PasswordReset.user_id == user.id))
    pr.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db.commit()

    r = client.post("/api/auth/verify-otp", json={"email": "heidi@test.dev", "otp": otp})
    assert r.status_code == 400
    assert r.json()["code"] == "OTP_EXPIRED"


def test_dashboard_requires_auth(client):
    r = client.get("/api/dashboard/summary")
    assert r.status_code == 401
    assert r.json()["code"] == "UNAUTHORIZED"


def test_dashboard_summary_with_metrics(manager):
    from tests.helpers import create, run, setup_world

    w = setup_world(manager)
    # Receive 10 kg Steel Rod (min 20, max 200) -> on_hand=10 < min=20 -> low stock
    run(manager, "receipt", [{"product_id": w["steel"], "quantity": "10"}], dst=w["loc"]["Stock"])

    # Create open operations (receipt, delivery, transfer)
    create(
        manager,
        "receipt",
        [{"product_id": w["steel"], "quantity": "50"}],
        dst=w["loc"]["Stock"],
    )
    create(
        manager,
        "delivery",
        [{"product_id": w["steel"], "quantity": "5"}],
        src=w["loc"]["Stock"],
    )
    create(
        manager,
        "transfer",
        [{"product_id": w["steel"], "quantity": "2"}],
        src=w["loc"]["Stock"],
        dst=w["loc"]["Rack A"],
    )

    r = manager.get("/api/dashboard/summary")
    assert r.status_code == 200, r.json()
    data = r.json()

    # Verify KPI counts
    kpis = data["kpis"]
    assert kpis["pending_receipts"] >= 1
    assert kpis["pending_deliveries"] >= 1
    assert kpis["scheduled_transfers"] >= 1
    assert kpis["low_stock"] >= 1
    assert data["ledger_ok"] is True

    # Verify low_stock_items contains Steel Rod
    low_item = next((item for item in data["low_stock_items"] if item["sku"] == "STL001"), None)
    assert low_item is not None
    assert low_item["stock_status"] == "low"
    assert low_item["on_hand"] == "10.000"
    assert low_item["min_qty"] == "20.000"
    assert low_item["suggested_order"] == "190.000"

    # Verify recent operations list
    assert len(data["recent_operations"]) >= 3


def test_dashboard_filters(manager):
    from tests.helpers import setup_world

    w = setup_world(manager)
    wh_id = w["wh"]["id"]

    # Filter with valid warehouse_id
    r = manager.get("/api/dashboard/summary", params={"warehouse_id": wh_id})
    assert r.status_code == 200
    assert r.json()["ledger_ok"] is True

    # Filter with non-existent warehouse_id (0 open operations, 0 products in stock)
    r_empty = manager.get("/api/dashboard/summary", params={"warehouse_id": 99999})
    assert r_empty.status_code == 200
    assert r_empty.json()["kpis"]["pending_receipts"] == 0


def test_logout_with_bad_cookie(client):
    # 1. No cookie at all -> 204
    client.cookies.clear()
    r = client.post("/api/auth/logout")
    assert r.status_code == 204

    # 2. Forged / invalid cookie -> 204 without 401 error
    client.cookies.set(SESSION_COOKIE, "forged.bad.token")
    r2 = client.post("/api/auth/logout")
    assert r2.status_code == 204


def test_concurrent_login_lockout():
    from concurrent.futures import ThreadPoolExecutor

    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        c.post(
            "/api/auth/signup",
            json={"name": "Race User", "email": "race@test.dev", "password": "CorrectPass123"},
        )

    def attempt_login():
        with TestClient(app) as c:
            return c.post(
                "/api/auth/login",
                json={"email": "race@test.dev", "password": "WrongPassword123"},
            ).status_code

    with ThreadPoolExecutor(max_workers=10) as executor:
        statuses = list(executor.map(lambda _: attempt_login(), range(10)))

    # All requests should return either 401 (unauthorized) or 429 (locked)
    assert all(s in (401, 429) for s in statuses)
    assert statuses.count(401) <= 5

    with TestClient(app) as c:
        locked_res = c.post(
            "/api/auth/login",
            json={"email": "race@test.dev", "password": "WrongPassword123"},
        )
        assert locked_res.status_code == 429
        assert locked_res.json()["code"] == "TOO_MANY_ATTEMPTS"


def test_concurrent_otp_rate_limiting(monkeypatch):
    from concurrent.futures import ThreadPoolExecutor

    from fastapi.testclient import TestClient

    from app.main import app

    captured = []
    monkeypatch.setattr(
        "app.services.auth_service.send_otp_email",
        lambda email, otp: captured.append((email, otp)),
    )

    with TestClient(app) as c:
        c.post(
            "/api/auth/signup",
            json={"name": "OTP Race", "email": "otprace@test.dev", "password": "Password123"},
        )
        c.post("/api/auth/forgot-password", json={"email": "otprace@test.dev"})

    def attempt_otp():
        with TestClient(app) as c:
            return c.post(
                "/api/auth/verify-otp",
                json={"email": "otprace@test.dev", "otp": "000000"},
            ).status_code

    with ThreadPoolExecutor(max_workers=10) as executor:
        statuses = list(executor.map(lambda _: attempt_otp(), range(10)))

    assert all(s in (400, 429) for s in statuses)
    assert statuses.count(400) <= 5

    with TestClient(app) as c:
        r = c.post(
            "/api/auth/verify-otp",
            json={"email": "otprace@test.dev", "otp": "000000"},
        )
        assert r.status_code == 429


def test_dashboard_products_in_stock_seed_like(manager):
    from tests.helpers import run, setup_world

    w = setup_world(manager)
    # STL001 (min 20) -> on_hand 0 -> out
    # CHR001 (min 0) -> on_hand 0 -> out

    p_in1 = manager.post(
        "/api/products",
        json={
            "sku": "PIN001",
            "name": "In Stock 1",
            "uom": "unit",
            "min_qty": "10",
            "max_qty": "100",
        },
    ).json()["id"]
    p_in2 = manager.post(
        "/api/products",
        json={
            "sku": "PIN002",
            "name": "In Stock 2",
            "uom": "unit",
            "min_qty": "10",
            "max_qty": "100",
        },
    ).json()["id"]
    p_low = manager.post(
        "/api/products",
        json={
            "sku": "PLOW01",
            "name": "Low Stock",
            "uom": "unit",
            "min_qty": "50",
            "max_qty": "100",
        },
    ).json()["id"]

    run(manager, "receipt", [{"product_id": p_in1, "quantity": "50"}], dst=w["loc"]["Stock"])
    run(manager, "receipt", [{"product_id": p_in2, "quantity": "30"}], dst=w["loc"]["Stock"])
    run(manager, "receipt", [{"product_id": p_low, "quantity": "20"}], dst=w["loc"]["Stock"])

    r = manager.get("/api/dashboard/summary")
    assert r.status_code == 200
    kpis = r.json()["kpis"]
    # 2 "in_stock" + 1 "low" = 3 products_in_stock!
    assert kpis["products_in_stock"] == 3
    assert kpis["low_stock"] == 1
    assert kpis["out_of_stock"] == 2


def test_dashboard_alerts_include_out_of_stock_first(manager):
    from tests.helpers import run, setup_world

    w = setup_world(manager)  # Steel (min 20/max 200) and Chair (no reorder rule) start empty
    run(manager, "receipt", [{"product_id": w["steel"], "quantity": "5"}], dst=w["loc"]["Stock"])
    manager.post(
        "/api/products",
        json={"sku": "MTR001", "name": "Motor", "uom": "unit", "min_qty": "5", "max_qty": "40"},
    )

    items = manager.get("/api/dashboard/summary").json()["low_stock_items"]
    assert [(i["sku"], i["stock_status"], i["suggested_order"]) for i in items] == [
        ("CHR001", "out", "0.000"),  # out, but no reorder rule -> nothing to suggest
        ("MTR001", "out", "40.000"),  # out of stock comes first, reorder up to max
        ("STL001", "low", "195.000"),
    ]
