def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "db": "ok"}
    assert r.headers["x-request-id"]


def test_unknown_route_uses_error_shape(client):
    r = client.get("/api/does-not-exist")
    assert r.status_code == 404
    assert set(r.json()) == {"code", "message", "details", "field_errors"}
