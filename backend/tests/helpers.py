"""Small API helpers shared by engine tests."""


def setup_world(c):
    """WH with Stock, Rack A, Production Floor; products Steel Rod (kg) and Chair (unit)."""
    wh = c.post("/api/warehouses", json={"code": "WH", "name": "Main Warehouse"}).json()
    for name in ("Rack A", "Production Floor"):
        c.post("/api/locations", json={"warehouse_id": wh["id"], "name": name})
    locs = {loc["name"]: loc["id"] for loc in c.get("/api/locations").json()}
    steel = c.post(
        "/api/products",
        json={"sku": "STL001", "name": "Steel Rod", "uom": "kg", "min_qty": "20", "max_qty": "200"},
    ).json()
    chair = c.post("/api/products", json={"sku": "CHR001", "name": "Chair", "uom": "unit"}).json()
    return {"wh": wh, "loc": locs, "steel": steel["id"], "chair": chair["id"]}


def create(c, type_, lines, src=None, dst=None, **extra):
    body = {"type": type_, "lines": lines, **extra}
    if src is not None:
        body["source_location_id"] = src
    if dst is not None:
        body["destination_location_id"] = dst
    return c.post("/api/operations", json=body)


def run(c, type_, lines, src=None, dst=None):
    """Create + validate; returns the validate response."""
    r = create(c, type_, lines, src, dst)
    assert r.status_code == 201, r.json()
    return c.post(f"/api/operations/{r.json()['id']}/validate")


def qty(c, product_id, location_id) -> str:
    return c.get(
        "/api/inventory/available", params={"product_id": product_id, "location_id": location_id}
    ).json()["quantity"]


def total(c, product_id) -> str:
    return c.get(f"/api/products/{product_id}").json()["on_hand"]
