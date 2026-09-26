def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "db": "ok"}
    assert r.headers["x-request-id"]


def test_unknown_route_uses_error_shape(client):
    r = client.get("/api/does-not-exist")
    assert r.status_code == 404
    assert set(r.json()) == {"code", "message", "details", "field_errors"}


def test_root_redirects_to_docs(client):
    r = client.get("/", follow_redirects=False)
    assert r.status_code == 307 and r.headers["location"] == "/docs"


def test_plain_postgres_urls_get_psycopg_driver():
    from app.config import Settings

    for raw in ("postgres://u:p@h/db", "postgresql://u:p@h/db?sslmode=require"):
        assert Settings(database_url=raw).database_url.startswith("postgresql+psycopg://u:p@h/db")


def test_production_refuses_dev_jwt_secret():
    import pytest
    from pydantic import ValidationError

    from app.config import Settings

    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(cookie_secure=True, jwt_secret="dev-insecure-secret-change-me")
